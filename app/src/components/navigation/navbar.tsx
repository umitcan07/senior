import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/tanstack-react-start";
import { RiCloseLine, RiMenuLine, RiSettings3Line } from "@remixicon/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NonceLogo } from "@/components/ui/nonce";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface NavLinkItem {
	to: string;
	label: string;
}

const mainNavLinks: NavLinkItem[] = [
	{ to: "/learn", label: "Learn" },
	{ to: "/practice", label: "Practice" },
	{ to: "/summary", label: "Summary" },
];

const adminNavLinks: NavLinkItem[] = [
	{ to: "/admin/text", label: "Texts" },
	{ to: "/admin/references", label: "References" },
	{ to: "/admin/authors", label: "Authors" },
];

function NavLink({
	to,
	label,
	isActive,
	onClick,
}: NavLinkItem & { isActive: boolean; onClick?: () => void }) {
	return (
		<Link
			to={to}
			onClick={onClick}
			className={cn(
				"relative rounded-full px-4 py-1.5 font-medium text-sm transition-colors hover:bg-neutral-50 active:bg-neutral-100 dark:active:bg-neutral-900 dark:hover:bg-neutral-950",
				"hover:text-foreground",
				isActive
					? "bg-neutral-100 text-foreground hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-900"
					: "text-muted-foreground",
			)}
		>
			{label}
		</Link>
	);
}

function MobileNavLink({
	to,
	label,
	isActive,
	onClick,
}: NavLinkItem & { isActive: boolean; onClick?: () => void }) {
	return (
		<Link
			to={to}
			onClick={onClick}
			className={cn(
				"block px-4 py-3 font-medium text-sm transition-colors",
				"hover:bg-muted",
				isActive ? "bg-muted/50 text-foreground" : "text-muted-foreground",
			)}
		>
			{label}
		</Link>
	);
}

interface NavbarProps {
	isAdmin?: boolean;
	className?: string;
}

export function Navbar({ isAdmin = false, className }: NavbarProps) {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	const closeMobileMenu = useCallback(() => {
		setIsMobileMenuOpen(false);
	}, []);

	// Close mobile menu on route change
	useEffect(() => {
		closeMobileMenu();
	}, [closeMobileMenu]);

	// Close mobile menu on escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closeMobileMenu();
			}
		};

		if (isMobileMenuOpen) {
			document.addEventListener("keydown", handleEscape);
			return () => document.removeEventListener("keydown", handleEscape);
		}
	}, [isMobileMenuOpen, closeMobileMenu]);

	const isRouteActive = (to: string) => {
		if (to === "/") return currentPath === "/";
		return currentPath.startsWith(to);
	};

	return (
		<header
			className={cn(
				"sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60",
				className,
			)}
		>
			<nav
				aria-label="Main navigation"
				className="container mx-auto max-w-7xl px-6 md:px-10"
			>
				<div className="flex h-14 items-center justify-between">
					{/* Logo */}
					<Link
						to="/"
						className="flex min-w-32 items-center transition-opacity hover:opacity-80"
					>
						<NonceLogo height={22} />
					</Link>

					{/* Desktop Navigation */}
					<div className="hidden items-center gap-1 md:flex">
						{mainNavLinks.map((link) => (
							<NavLink
								key={link.to}
								{...link}
								isActive={isRouteActive(link.to)}
							/>
						))}
						{isAdmin && (
							<>
								<span className="mx-2 h-4 w-px bg-border" />
								{adminNavLinks.map((link) => (
									<NavLink
										key={link.to}
										{...link}
										isActive={isRouteActive(link.to)}
									/>
								))}
							</>
						)}
					</div>

					{/* Right Side Actions */}
					<div className="flex items-center justify-end gap-4">
						<ThemeToggle />
						<Button variant="ghost" size="icon" asChild>
							<Link to="/settings">
								<RiSettings3Line size={20} />
							</Link>
						</Button>
						<div className="min-w-32">
							<SignedIn>
								<div className="flex w-32 items-center gap-7">
									<div className="h-3 w-px bg-border" />
									<UserButton
										appearance={{
											elements: {
												avatarBox: "size-8",
											},
										}}
									/>
								</div>
							</SignedIn>
							<SignedOut>
								<div className="w-32">
									<Button variant="default" size="sm" asChild>
										<SignInButton />
									</Button>
								</div>
							</SignedOut>
						</div>

						<Button
							variant="ghost"
							size="icon"
							className="md:hidden"
							onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
							aria-expanded={isMobileMenuOpen}
							aria-controls="mobile-menu"
							aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
						>
							{isMobileMenuOpen ? (
								<RiCloseLine size={24} />
							) : (
								<RiMenuLine size={24} />
							)}
						</Button>
					</div>
				</div>

				{/* Mobile Menu */}
				{isMobileMenuOpen && (
					<div id="mobile-menu" className="border-t py-2 md:hidden">
						<div className="space-y-1">
							{mainNavLinks.map((link) => (
								<MobileNavLink
									key={link.to}
									{...link}
									isActive={isRouteActive(link.to)}
									onClick={closeMobileMenu}
								/>
							))}
							{isAdmin && (
								<>
									<div className="my-2 border-t" />
									<div className="px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
										Admin
									</div>
									{adminNavLinks.map((link) => (
										<MobileNavLink
											key={link.to}
											{...link}
											isActive={isRouteActive(link.to)}
											onClick={closeMobileMenu}
										/>
									))}
								</>
							)}
						</div>
					</div>
				)}
			</nav>
		</header>
	);
}
