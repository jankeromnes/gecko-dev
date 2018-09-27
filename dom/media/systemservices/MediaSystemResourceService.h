/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et cindent: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#if !defined(MediaSystemResourceService_h_)
#define MediaSystemResourceService_h_

#include <deque>

#include "MediaSystemResourceTypes.h"
#include "mozilla/StaticPtr.h"
#include "nsClassHashtable.h"

namespace mozilla {

namespace media {
class MediaSystemResourceManagerParent;
} // namespace media

/**
 * Manage media system resource allocation requests within system.
 */
class MediaSystemResourceService
{
public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(MediaSystemResourceService)

  static MediaSystemResourceService* Get();
  static void Init();
  static void Shutdown();

  void Acquire(media::MediaSystemResourceManagerParent* apparent,
               uint32_t aId,
               MediaSystemResourceType aResourceType,
               bool aWillWait);

  void ReleaseResource(media::MediaSystemResourceManagerParent* apparent,
                       uint32_t aId,
                       MediaSystemResourceType aResourceType);

  void ReleaseResource(media::MediaSystemResourceManagerParent* apparent);

private:
  MediaSystemResourceService();
  ~MediaSystemResourceService();

  struct MediaSystemResourceRequest {
    MediaSystemResourceRequest()
      : mParent(nullptr), mId(-1) {}
    MediaSystemResourceRequest(media::MediaSystemResourceManagerParent* apparent, uint32_t aId)
      : mParent(apparent), mId(aId) {}
    media::MediaSystemResourceManagerParent* mParent;
    uint32_t mId;
  };

  struct MediaSystemResource {
    MediaSystemResource()
      : mResourceCount(0) {}
    explicit MediaSystemResource(uint32_t aResourceCount)
      : mResourceCount(aResourceCount) {}

    std::deque<MediaSystemResourceRequest> mWaitingRequests;
    std::deque<MediaSystemResourceRequest> mAcquiredRequests;
    uint32_t mResourceCount;
  };

  void Destroy();

  void RemoveRequest(media::MediaSystemResourceManagerParent* apparent,
                     uint32_t aId,
                     MediaSystemResourceType aResourceType);

  void RemoveRequests(media::MediaSystemResourceManagerParent* apparent,
                      MediaSystemResourceType aResourceType);

  void UpdateRequests(MediaSystemResourceType aResourceType);

  bool mDestroyed;

  nsClassHashtable<nsUint32HashKey, MediaSystemResource> mResources;

  static StaticRefPtr<MediaSystemResourceService> sSingleton;
};

} // namespace mozilla

#endif
