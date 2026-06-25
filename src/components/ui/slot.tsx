import * as React from "react";

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

export const Slot = React.forwardRef<HTMLElement, SlotProps>(({ children, ...props }, ref) => {
  if (!React.isValidElement(children)) return null;
  return React.cloneElement(children, { ...props, ref } as React.HTMLAttributes<HTMLElement>);
});
Slot.displayName = "Slot";
