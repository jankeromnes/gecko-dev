/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsTitleBarFrame_h___
#define nsTitleBarFrame_h___

#include "mozilla/Attributes.h"
#include "mozilla/EventForwards.h"
#include "nsBoxFrame.h"

class nsTitleBarFrame : public nsBoxFrame {
 public:
  NS_DECL_FRAMEARENA_HELPERS(nsTitleBarFrame)

  friend nsIFrame* NS_NewTitleBarFrame(nsIPresShell* aPresShell,
                                       ComputedStyle* aStyle);

  explicit nsTitleBarFrame(ComputedStyle* aStyle, ClassID = kClassID);

  virtual void BuildDisplayListForChildren(
      nsDisplayListBuilder* aBuilder, const nsDisplayListSet& aLists) override;

  virtual nsresult HandleEvent(nsPresContext* aPresContext,
                               mozilla::WidgetGUIEvent* aEvent,
                               nsEventStatus* aEventStatus) override;

  virtual void MouseClicked(mozilla::WidgetMouseEvent* aEvent);

  void UpdateMouseThrough() override {
    AddStateBits(NS_FRAME_MOUSE_THROUGH_NEVER);
  }

 protected:
  bool mTrackingMouseMove;
  mozilla::LayoutDeviceIntPoint mLastPoint;

};  // class nsTitleBarFrame

#endif /* nsTitleBarFrame_h___ */
