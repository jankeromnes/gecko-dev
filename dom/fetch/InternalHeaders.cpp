/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/dom/InternalHeaders.h"

#include "mozilla/dom/FetchTypes.h"
#include "mozilla/ErrorResult.h"

#include "nsCharSeparatedTokenizer.h"
#include "nsContentUtils.h"
#include "nsIHttpHeaderVisitor.h"
#include "nsNetUtil.h"
#include "nsReadableUtils.h"

namespace mozilla {
namespace dom {

InternalHeaders::InternalHeaders(const nsTArray<Entry>&& aHeaders,
                                 HeadersGuardEnum aGuard)
    : mGuard(aGuard), mList(aHeaders), mListDirty(true) {}

InternalHeaders::InternalHeaders(
    const nsTArray<HeadersEntry>& aHeadersEntryList, HeadersGuardEnum aGuard)
    : mGuard(aGuard), mListDirty(true) {
  for (const HeadersEntry& headersEntry : aHeadersEntryList) {
    mList.AppendElement(Entry(headersEntry.name(), headersEntry.value()));
  }
}

void InternalHeaders::ToIPC(nsTArray<HeadersEntry>& aIPCHeaders,
                            HeadersGuardEnum& aGuard) {
  aGuard = mGuard;

  aIPCHeaders.Clear();
  for (Entry& entry : mList) {
    aIPCHeaders.AppendElement(HeadersEntry(entry.mName, entry.mValue));
  }
}

void InternalHeaders::Append(const nsACString& aName, const nsACString& aValue,
                             ErrorResult& aRv) {
  nsAutoCString lowerName;
  ToLowerCase(aName, lowerName);
  nsAutoCString trimValue;
  NS_TrimHTTPWhitespace(aValue, trimValue);

  if (IsInvalidMutableHeader(lowerName, trimValue, aRv)) {
    return;
  }

  SetListDirty();

  mList.AppendElement(Entry(lowerName, trimValue));
}

void InternalHeaders::Delete(const nsACString& aName, ErrorResult& aRv) {
  nsAutoCString lowerName;
  ToLowerCase(aName, lowerName);

  if (IsInvalidMutableHeader(lowerName, aRv)) {
    return;
  }

  SetListDirty();

  // remove in reverse order to minimize copying
  for (int32_t i = mList.Length() - 1; i >= 0; --i) {
    if (lowerName == mList[i].mName) {
      mList.RemoveElementAt(i);
    }
  }
}

void InternalHeaders::Get(const nsACString& aName, nsACString& aValue,
                          ErrorResult& aRv) const {
  nsAutoCString lowerName;
  ToLowerCase(aName, lowerName);

  if (IsInvalidName(lowerName, aRv)) {
    return;
  }

  const char* delimiter = ", ";
  bool firstValueFound = false;

  for (uint32_t i = 0; i < mList.Length(); ++i) {
    if (lowerName == mList[i].mName) {
      if (firstValueFound) {
        aValue += delimiter;
      }
      aValue += mList[i].mValue;
      firstValueFound = true;
    }
  }

  // No value found, so return null to content
  if (!firstValueFound) {
    aValue.SetIsVoid(true);
  }
}

void InternalHeaders::GetFirst(const nsACString& aName, nsACString& aValue,
                               ErrorResult& aRv) const {
  nsAutoCString lowerName;
  ToLowerCase(aName, lowerName);

  if (IsInvalidName(lowerName, aRv)) {
    return;
  }

  for (uint32_t i = 0; i < mList.Length(); ++i) {
    if (lowerName == mList[i].mName) {
      aValue = mList[i].mValue;
      return;
    }
  }

  // No value found, so return null to content
  aValue.SetIsVoid(true);
}

bool InternalHeaders::Has(const nsACString& aName, ErrorResult& aRv) const {
  nsAutoCString lowerName;
  ToLowerCase(aName, lowerName);

  if (IsInvalidName(lowerName, aRv)) {
    return false;
  }

  for (uint32_t i = 0; i < mList.Length(); ++i) {
    if (lowerName == mList[i].mName) {
      return true;
    }
  }
  return false;
}

void InternalHeaders::Set(const nsACString& aName, const nsACString& aValue,
                          ErrorResult& aRv) {
  nsAutoCString lowerName;
  ToLowerCase(aName, lowerName);
  nsAutoCString trimValue;
  NS_TrimHTTPWhitespace(aValue, trimValue);

  if (IsInvalidMutableHeader(lowerName, trimValue, aRv)) {
    return;
  }

  SetListDirty();

  int32_t firstIndex = INT32_MAX;

  // remove in reverse order to minimize copying
  for (int32_t i = mList.Length() - 1; i >= 0; --i) {
    if (lowerName == mList[i].mName) {
      firstIndex = std::min(firstIndex, i);
      mList.RemoveElementAt(i);
    }
  }

  if (firstIndex < INT32_MAX) {
    Entry* entry = mList.InsertElementAt(firstIndex);
    entry->mName = lowerName;
    entry->mValue = trimValue;
  } else {
    mList.AppendElement(Entry(lowerName, trimValue));
  }
}

void InternalHeaders::Clear() {
  SetListDirty();
  mList.Clear();
}

void InternalHeaders::SetGuard(HeadersGuardEnum aGuard, ErrorResult& aRv) {
  // The guard is only checked during ::Set() and ::Append() in the spec.  It
  // does not require revalidating headers already set.
  mGuard = aGuard;
}

InternalHeaders::~InternalHeaders() {}

// static
bool InternalHeaders::IsSimpleHeader(const nsACString& aName,
                                     const nsACString& aValue) {
  if (aValue.Length() > 128) {
    return false;
  }
  // Note, we must allow a null content-type value here to support
  // get("content-type"), but the IsInvalidValue() check will prevent null
  // from being set or appended.
  return (aName.EqualsLiteral("accept") &&
          nsContentUtils::IsAllowedNonCorsAccept(aValue)) ||
         (aName.EqualsLiteral("accept-language") &&
          nsContentUtils::IsAllowedNonCorsLanguage(aValue)) ||
         (aName.EqualsLiteral("content-language") &&
          nsContentUtils::IsAllowedNonCorsLanguage(aValue)) ||
         (aName.EqualsLiteral("content-type") &&
          nsContentUtils::IsAllowedNonCorsContentType(aValue));
}

// static
bool InternalHeaders::IsRevalidationHeader(const nsACString& aName) {
  return aName.EqualsLiteral("if-modified-since") ||
         aName.EqualsLiteral("if-none-match") ||
         aName.EqualsLiteral("if-unmodified-since") ||
         aName.EqualsLiteral("if-match") || aName.EqualsLiteral("if-range");
}

// static
bool InternalHeaders::IsInvalidName(const nsACString& aName, ErrorResult& aRv) {
  if (!NS_IsValidHTTPToken(aName)) {
    NS_ConvertUTF8toUTF16 label(aName);
    aRv.ThrowTypeError<MSG_INVALID_HEADER_NAME>(label);
    return true;
  }

  return false;
}

// static
bool InternalHeaders::IsInvalidValue(const nsACString& aValue,
                                     ErrorResult& aRv) {
  if (!NS_IsReasonableHTTPHeaderValue(aValue)) {
    NS_ConvertUTF8toUTF16 label(aValue);
    aRv.ThrowTypeError<MSG_INVALID_HEADER_VALUE>(label);
    return true;
  }
  return false;
}

bool InternalHeaders::IsImmutable(ErrorResult& aRv) const {
  if (mGuard == HeadersGuardEnum::Immutable) {
    aRv.ThrowTypeError<MSG_HEADERS_IMMUTABLE>();
    return true;
  }
  return false;
}

bool InternalHeaders::IsForbiddenRequestHeader(const nsACString& aName) const {
  return mGuard == HeadersGuardEnum::Request &&
         nsContentUtils::IsForbiddenRequestHeader(aName);
}

bool InternalHeaders::IsForbiddenRequestNoCorsHeader(
    const nsACString& aName) const {
  return mGuard == HeadersGuardEnum::Request_no_cors &&
         !IsSimpleHeader(aName, EmptyCString());
}

bool InternalHeaders::IsForbiddenRequestNoCorsHeader(
    const nsACString& aName, const nsACString& aValue) const {
  return mGuard == HeadersGuardEnum::Request_no_cors &&
         !IsSimpleHeader(aName, aValue);
}

bool InternalHeaders::IsForbiddenResponseHeader(const nsACString& aName) const {
  return mGuard == HeadersGuardEnum::Response &&
         nsContentUtils::IsForbiddenResponseHeader(aName);
}

void InternalHeaders::Fill(const InternalHeaders& aInit, ErrorResult& aRv) {
  const nsTArray<Entry>& list = aInit.mList;
  for (uint32_t i = 0; i < list.Length() && !aRv.Failed(); ++i) {
    const Entry& entry = list[i];
    Append(entry.mName, entry.mValue, aRv);
  }
}

void InternalHeaders::Fill(const Sequence<Sequence<nsCString>>& aInit,
                           ErrorResult& aRv) {
  for (uint32_t i = 0; i < aInit.Length() && !aRv.Failed(); ++i) {
    const Sequence<nsCString>& tuple = aInit[i];
    if (tuple.Length() != 2) {
      aRv.ThrowTypeError<MSG_INVALID_HEADER_SEQUENCE>();
      return;
    }
    Append(tuple[0], tuple[1], aRv);
  }
}

void InternalHeaders::Fill(const Record<nsCString, nsCString>& aInit,
                           ErrorResult& aRv) {
  for (auto& entry : aInit.Entries()) {
    Append(entry.mKey, entry.mValue, aRv);
    if (aRv.Failed()) {
      return;
    }
  }
}

namespace {

class FillHeaders final : public nsIHttpHeaderVisitor {
  RefPtr<InternalHeaders> mInternalHeaders;

  ~FillHeaders() = default;

 public:
  NS_DECL_ISUPPORTS

  explicit FillHeaders(InternalHeaders* aInternalHeaders)
      : mInternalHeaders(aInternalHeaders) {
    MOZ_DIAGNOSTIC_ASSERT(mInternalHeaders);
  }

  NS_IMETHOD
  VisitHeader(const nsACString& aHeader, const nsACString& aValue) override {
    mInternalHeaders->Append(aHeader, aValue, IgnoreErrors());
    return NS_OK;
  }
};

NS_IMPL_ISUPPORTS(FillHeaders, nsIHttpHeaderVisitor)

}  // namespace

void InternalHeaders::FillResponseHeaders(nsIRequest* aRequest) {
  nsCOMPtr<nsIHttpChannel> httpChannel = do_QueryInterface(aRequest);
  if (!httpChannel) {
    return;
  }

  RefPtr<FillHeaders> visitor = new FillHeaders(this);
  nsresult rv = httpChannel->VisitResponseHeaders(visitor);
  if (NS_FAILED(rv)) {
    NS_WARNING("failed to fill headers");
  }
}

bool InternalHeaders::HasOnlySimpleHeaders() const {
  for (uint32_t i = 0; i < mList.Length(); ++i) {
    if (!IsSimpleHeader(mList[i].mName, mList[i].mValue)) {
      return false;
    }
  }

  return true;
}

bool InternalHeaders::HasRevalidationHeaders() const {
  for (uint32_t i = 0; i < mList.Length(); ++i) {
    if (IsRevalidationHeader(mList[i].mName)) {
      return true;
    }
  }

  return false;
}

// static
already_AddRefed<InternalHeaders> InternalHeaders::BasicHeaders(
    InternalHeaders* aHeaders) {
  RefPtr<InternalHeaders> basic = new InternalHeaders(*aHeaders);
  ErrorResult result;
  // The Set-Cookie headers cannot be invalid mutable headers, so the Delete
  // must succeed.
  basic->Delete(NS_LITERAL_CSTRING("Set-Cookie"), result);
  MOZ_ASSERT(!result.Failed());
  basic->Delete(NS_LITERAL_CSTRING("Set-Cookie2"), result);
  MOZ_ASSERT(!result.Failed());
  return basic.forget();
}

// static
already_AddRefed<InternalHeaders> InternalHeaders::CORSHeaders(
    InternalHeaders* aHeaders) {
  RefPtr<InternalHeaders> cors = new InternalHeaders(aHeaders->mGuard);
  ErrorResult result;

  nsAutoCString acExposedNames;
  aHeaders->GetFirst(NS_LITERAL_CSTRING("Access-Control-Expose-Headers"),
                     acExposedNames, result);
  MOZ_ASSERT(!result.Failed());

  AutoTArray<nsCString, 5> exposeNamesArray;
  nsCCharSeparatedTokenizer exposeTokens(acExposedNames, ',');
  while (exposeTokens.hasMoreTokens()) {
    const nsDependentCSubstring& token = exposeTokens.nextToken();
    if (token.IsEmpty()) {
      continue;
    }

    if (!NS_IsValidHTTPToken(token)) {
      NS_WARNING(
          "Got invalid HTTP token in Access-Control-Expose-Headers. Header "
          "value is:");
      NS_WARNING(acExposedNames.get());
      exposeNamesArray.Clear();
      break;
    }

    exposeNamesArray.AppendElement(token);
  }

  nsCaseInsensitiveCStringArrayComparator comp;
  for (uint32_t i = 0; i < aHeaders->mList.Length(); ++i) {
    const Entry& entry = aHeaders->mList[i];
    if (entry.mName.EqualsASCII("cache-control") ||
        entry.mName.EqualsASCII("content-language") ||
        entry.mName.EqualsASCII("content-type") ||
        entry.mName.EqualsASCII("expires") ||
        entry.mName.EqualsASCII("last-modified") ||
        entry.mName.EqualsASCII("pragma") ||
        exposeNamesArray.Contains(entry.mName, comp)) {
      cors->Append(entry.mName, entry.mValue, result);
      MOZ_ASSERT(!result.Failed());
    }
  }

  return cors.forget();
}

void InternalHeaders::GetEntries(
    nsTArray<InternalHeaders::Entry>& aEntries) const {
  MOZ_ASSERT(aEntries.IsEmpty());
  aEntries.AppendElements(mList);
}

void InternalHeaders::GetUnsafeHeaders(nsTArray<nsCString>& aNames) const {
  MOZ_ASSERT(aNames.IsEmpty());
  for (uint32_t i = 0; i < mList.Length(); ++i) {
    const Entry& header = mList[i];
    if (!InternalHeaders::IsSimpleHeader(header.mName, header.mValue)) {
      aNames.AppendElement(header.mName);
    }
  }
}

void InternalHeaders::MaybeSortList() {
  class Comparator {
   public:
    bool Equals(const Entry& aA, const Entry& aB) const {
      return aA.mName == aB.mName;
    }

    bool LessThan(const Entry& aA, const Entry& aB) const {
      return aA.mName < aB.mName;
    }
  };

  if (!mListDirty) {
    return;
  }

  mListDirty = false;

  Comparator comparator;

  mSortedList.Clear();
  for (const Entry& entry : mList) {
    bool found = false;
    for (Entry& sortedEntry : mSortedList) {
      if (sortedEntry.mName == entry.mName) {
        sortedEntry.mValue += ", ";
        sortedEntry.mValue += entry.mValue;
        found = true;
        break;
      }
    }

    if (!found) {
      mSortedList.InsertElementSorted(entry, comparator);
    }
  }
}

void InternalHeaders::SetListDirty() {
  mSortedList.Clear();
  mListDirty = true;
}

}  // namespace dom
}  // namespace mozilla
