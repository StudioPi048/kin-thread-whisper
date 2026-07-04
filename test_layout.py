import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# Let's fix the gap once and for all by introducing a true contour-like logic or simply 
# trusting desiredOffset if we want a tight layout. Since the user wants a tight layout 
# ("encostar irmãos"), we can use desiredOffset, but bounded by a smaller minimum.
# Actually, let's just make rightOffsetX = desiredOffset for blockRoot!

content = content.replace(
"""    const FAMILY_GAP = 40; 
    const rightOffsetX = leftBlock.width + (leftBlock.width > 0 && rightBlock.width > 0 ? FAMILY_GAP : 0);""",
"""    const FAMILY_GAP = 40; 
    let rightOffsetX = leftBlock.width + (leftBlock.width > 0 && rightBlock.width > 0 ? FAMILY_GAP : 0);
    // TIGHT LAYOUT FIX: If both blocks have a childTarget, we can pull them closer 
    // to prevent massive empty gaps, as long as it doesn't cause negative coordinates.
    if (leftBlock.childTargetX !== undefined && rightBlock.childTargetX !== undefined) {
      const desiredOffset = leftBlock.childTargetX + HORIZONTAL_STEP + FAMILY_GAP - rightBlock.childTargetX;
      // We use desiredOffset, but ensure we don't overlap the child targets themselves
      rightOffsetX = Math.max(desiredOffset, leftBlock.childTargetX + HORIZONTAL_STEP - rightBlock.childTargetX);
    }""")

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)
