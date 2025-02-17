/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/Attributes.h"

#ifndef _MSC_VER  // Not supported by clang-cl yet

// When running with AddressSanitizer, we need to explicitly set some
// options specific to our codebase to prevent errors during runtime.
// To override these, set the ASAN_OPTIONS environment variable.
//
// Currently, these are:
//
//   allow_user_segv_handler=1 - Tell ASan to allow our code to use its
//   own SIGSEGV handlers. This is required by ASM.js internally.
//
//   alloc_dealloc_mismatch=0 - Disable alloc-dealloc mismatch checking
//   in ASan. This is required because we define our own new/delete
//   operators that are backed by malloc/free. If one of them gets inlined
//   while the other doesn't, ASan will report false positives.
//
//   detect_leaks=0 - Disable LeakSanitizer. This is required because
//   otherwise leak checking will be enabled for various building and
//   testing executables where we don't care much about leaks. Enabling
//   this will also likely require setting LSAN_OPTIONS with a suppression
//   file, as in build/sanitizers/lsan_suppressions.txt.
//
//   allocator_may_return_null=1 - Tell ASan to return NULL when an allocation
//   fails instead of aborting the program. This allows us to handle failing
//   allocations the same way we would handle them with a regular allocator and
//   also uncovers potential bugs that might occur in these situations.
//
//   max_malloc_fill_size - Tell ASan to initialize memory to a certain value
//   when it is allocated. This option specifies the maximum allocation size
//   for which ASan should still initialize the memory. The value we specify
//   here is exactly 256MiB.
//
//   max_free_fill_size - Similar to max_malloc_fill_size, tell ASan to
//   overwrite memory with a certain value when it is freed. Again, the value
//   here specifies the maximum allocation size, larger allocations will
//   skipped.
//
//   malloc_fill_byte / free_fill_byte - These values specify the byte values
//   used to initialize/overwrite memory in conjunction with the previous
//   options max_malloc_fill_size and max_free_fill_size. The values used here
//   are 0xe4 and 0xe5 to match the kAllocPoison and kAllocJunk constants used
//   by mozjemalloc.
//
//   malloc_context_size - This value specifies how many stack frames are
//   stored for each malloc and free call. Since Firefox can have lots of deep
//   stacks with allocations, we limit the default size here further to save
//   some memory.
//
extern "C" MOZ_ASAN_BLACKLIST const char* __asan_default_options() {
  return "allow_user_segv_handler=1:alloc_dealloc_mismatch=0:detect_leaks=0"
#ifdef MOZ_ASAN_REPORTER
         ":malloc_context_size=20"
#endif
         ":max_free_fill_size=268435456:max_malloc_fill_size=268435456"
         ":malloc_fill_byte=228:free_fill_byte=229"
         ":handle_sigill=1"
         ":allocator_may_return_null=1";
}

#endif
