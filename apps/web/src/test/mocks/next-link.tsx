import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type LinkProps = PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>;

export default function Link({ href, children, ...rest }: LinkProps) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
