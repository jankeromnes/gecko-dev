//
// Copyright (c) 2017 The ANGLE Project Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//

#include "compiler/translator/IsASTDepthBelowLimit.h"

#include "compiler/translator/IntermTraverse.h"

namespace sh
{

namespace
{

// Traverse the tree and compute max depth. Takes a maximum depth limit to prevent stack overflow.
class MaxDepthTraverser : public TIntermTraverser
{
  public:
    MaxDepthTraverser(int depthLimit) : TIntermTraverser(true, true, false), mDepthLimit(depthLimit)
    {
    }

    bool visitBinary(Visit /*visit*/, TIntermBinary * /*node*/) override { return depthCheck(); }
    bool visitUnary(Visit /*visit*/, TIntermUnary * /*node*/) override { return depthCheck(); }
    bool visitTernary(Visit /*visit*/, TIntermTernary * /*node*/) override { return depthCheck(); }
    bool visitSwizzle(Visit /*visit*/, TIntermSwizzle * /*node*/) override { return depthCheck(); }
    bool visitIfElse(Visit /*visit*/, TIntermIfElse * /*node*/) override { return depthCheck(); }
    bool visitAggregate(Visit /*visit*/, TIntermAggregate * /*node*/) override { return depthCheck(); }
    bool visitBlock(Visit /*visit*/, TIntermBlock * /*node*/) override { return depthCheck(); }
    bool visitLoop(Visit /*visit*/, TIntermLoop * /*node*/) override { return depthCheck(); }
    bool visitBranch(Visit /*visit*/, TIntermBranch * /*node*/) override { return depthCheck(); }

  protected:
    bool depthCheck() const { return mMaxDepth < mDepthLimit; }

    int mDepthLimit;
};

}  // anonymous namespace

bool IsASTDepthBelowLimit(TIntermNode *root, int maxDepth)
{
    MaxDepthTraverser traverser(maxDepth + 1);
    root->traverse(&traverser);

    return traverser.getMaxDepth() <= maxDepth;
}

}  // namespace sh
