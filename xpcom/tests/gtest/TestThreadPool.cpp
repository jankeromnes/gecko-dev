/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <stdio.h>
#include <stdlib.h>
#include "nsXPCOM.h"
#include "nsXPCOMCIDInternal.h"
#include "nsThreadPool.h"
#include "nsComponentManagerUtils.h"
#include "nsCOMPtr.h"
#include "nsIRunnable.h"
#include "nsThreadUtils.h"
#include "mozilla/Atomics.h"
#include "mozilla/Monitor.h"
#include "gtest/gtest.h"

using namespace mozilla;

class Task final : public nsIRunnable
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS

  explicit Task(int i) : mIndex(i) {}

  NS_IMETHOD Run() override
  {
    printf("###(%d) running from thread: %p\n", mIndex, (void *) PR_GetCurrentThread());
    int r = (int) ((float) rand() * 200 / RAND_MAX);
    PR_Sleep(PR_MillisecondsToInterval(r));
    printf("###(%d) exiting from thread: %p\n", mIndex, (void *) PR_GetCurrentThread());
    ++sCount;
    return NS_OK;
  }

  static mozilla::Atomic<int> sCount;

private:
  ~Task() {}

  int mIndex;
};
NS_IMPL_ISUPPORTS(Task, nsIRunnable)

mozilla::Atomic<int> Task::sCount;

TEST(ThreadPool, Main)
{
  nsCOMPtr<nsIThreadPool> pool = new nsThreadPool();

  for (int i = 0; i < 100; ++i) {
    nsCOMPtr<nsIRunnable> task = new Task(i);
    EXPECT_TRUE(task);

    pool->Dispatch(task, NS_DISPATCH_NORMAL);
  }

  pool->Shutdown();
  EXPECT_EQ(Task::sCount, 100);
}

TEST(ThreadPool, Parallelism)
{
  nsCOMPtr<nsIThreadPool> pool = new nsThreadPool();

  // Dispatch and sleep to ensure we have an idle thread
  nsCOMPtr<nsIRunnable> r0 = new Runnable("TestRunnable");
  pool->Dispatch(r0, NS_DISPATCH_SYNC);
  PR_Sleep(PR_SecondsToInterval(2));

  class Runnable1 : public Runnable {
  public:
    Runnable1(Monitor& aMonitor, bool& aDone)
      : mozilla::Runnable("Runnable1")
      , mMonitor(aMonitor)
      , mDone(aDone)
    {
    }

    NS_IMETHOD Run() override {
      MonitorAutoLock mon(mMonitor);
      if (!mDone) {
        // Wait for a reasonable timeout since we don't want to block gtests
        // forever should any regression happen.
        mon.Wait(TimeDuration::FromSeconds(300));
      }
      EXPECT_TRUE(mDone);
      return NS_OK;
    }
  private:
    Monitor& mMonitor;
    bool& mDone;
  };

  class Runnable2 : public Runnable {
  public:
    Runnable2(Monitor& aMonitor, bool& aDone)
      : mozilla::Runnable("Runnable2")
      , mMonitor(aMonitor)
      , mDone(aDone)
    {
    }

    NS_IMETHOD Run() override {
      MonitorAutoLock mon(mMonitor);
      mDone = true;
      mon.NotifyAll();
      return NS_OK;
    }
  private:
    Monitor& mMonitor;
    bool& mDone;
  };

  // Dispatch 2 events in a row. Since we are still within the thread limit,
  // We should wake up the idle thread and spawn a new thread so these 2 events
  // can run in parallel. We will time out if r1 and r2 run in sequence for r1
  // won't finish until r2 finishes.
  Monitor mon("ThreadPool::Parallelism");
  bool done = false;
  nsCOMPtr<nsIRunnable> r1 = new Runnable1(mon, done);
  nsCOMPtr<nsIRunnable> r2 = new Runnable2(mon, done);
  pool->Dispatch(r1, NS_DISPATCH_NORMAL);
  pool->Dispatch(r2, NS_DISPATCH_NORMAL);

  pool->Shutdown();
}

TEST(ThreadPool, ShutdownWithTimeout)
{
  Task::sCount = 0;
  nsCOMPtr<nsIThreadPool> pool = new nsThreadPool();

  for (int i = 0; i < 4; ++i) {
    nsCOMPtr<nsIRunnable> task = new Task(i);
    EXPECT_TRUE(task);

    pool->Dispatch(task, NS_DISPATCH_NORMAL);
  }

  // Wait for a max of 300 ms. All threads should be done by then.
  pool->ShutdownWithTimeout(300);
  EXPECT_EQ(Task::sCount, 4);

  Task::sCount = 0;
  pool = new nsThreadPool();
  for (int i = 0; i < 3; ++i) {
    nsCOMPtr<nsIRunnable> task = new Task(i);
    EXPECT_TRUE(task);

    pool->Dispatch(task, NS_DISPATCH_NORMAL);
  }

  pool->Dispatch(NS_NewRunnableFunction("infinite-loop", []() {
      printf("### running from thread that never ends: %p\n",
             (void *) PR_GetCurrentThread());
      while(true) {
          PR_Sleep(PR_MillisecondsToInterval(100));
      }
      EXPECT_TRUE(false); // We should never get here.
    }), NS_DISPATCH_NORMAL);

  pool->ShutdownWithTimeout(1000);
  EXPECT_EQ(Task::sCount, 3);
}

TEST(ThreadPool, ShutdownWithTimeoutThenSleep)
{
  Task::sCount = 0;
  nsCOMPtr<nsIThreadPool> pool = new nsThreadPool();

  for (int i = 0; i < 3; ++i) {
    nsCOMPtr<nsIRunnable> task = new Task(i);
    EXPECT_TRUE(task);

    pool->Dispatch(task, NS_DISPATCH_NORMAL);
  }

  pool->Dispatch(NS_NewRunnableFunction("sleep-for-400-ms", []() {
      printf("### running from thread that sleeps for 400ms: %p\n",
             (void *) PR_GetCurrentThread());
      PR_Sleep(PR_MillisecondsToInterval(400));
      Task::sCount++;
      printf("### thread awoke from long sleep: %p\n",
             (void *) PR_GetCurrentThread());
    }), NS_DISPATCH_NORMAL);


  // Wait for a max of 300 ms. The thread should still be sleeping, and will
  // be leaked.
  pool->ShutdownWithTimeout(300);
  EXPECT_EQ(Task::sCount, 3);

  // Sleep for a bit, and wait for the last thread to finish up.
  PR_Sleep(PR_MillisecondsToInterval(200));

  // Process events so the shutdown ack is received
  NS_ProcessPendingEvents(NS_GetCurrentThread());

  EXPECT_EQ(Task::sCount, 4);
}
