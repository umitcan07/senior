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
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { NounceLogo } from "@/components/ui/nounce";
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
	}, [currentPath, closeMobileMenu]);

	const isRouteActive = (to: string) => {
		if (to === "/") return currentPath === "/";
		return currentPath.startsWith(to);
	};

	return (
		<header
			className={cn(
				"sticky top-0 z-50 border-b bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95",
				className,
			)}
		>
			<nav
				aria-label="Main navigation"
				className="container mx-auto max-w-7xl px-4 md:px-6"
			>
				<div className="grid h-14 grid-cols-3 items-center md:flex md:justify-between md:gap-3">
					{/* Mobile: Hamburger on left */}
					<div className="flex items-center gap-3 justify-self-start md:hidden">
						<Drawer
							open={isMobileMenuOpen}
							onOpenChange={setIsMobileMenuOpen}
							direction="left"
						>
							<DrawerTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									aria-expanded={isMobileMenuOpen}
									aria-controls="mobile-menu"
									aria-label="Open menu"
								className={cn(
									"rounded-lg transition-colors",
									isMobileMenuOpen && "bg-muted"
								)}
								>
									<RiMenuLine size={24} />
								</Button>
							</DrawerTrigger>
							<DrawerContent
								className="fixed inset-y-0 left-0 h-full w-[80vw] max-w-sm rounded-none border-r"
								aria-describedby={undefined}
							>
								<DrawerHeader className="flex h-14 items-center justify-between border-b px-4 py-0">
									<div className="flex items-center gap-3">
										<DrawerClose asChild>
											<Button
												variant="secondary"
												size="icon"
												className="size-9 rounded-lg"
												aria-label="Close menu"
											>
												<RiCloseLine size={24} />
											</Button>
										</DrawerClose>
										<NounceLogo height={20} />
									</div>
									<DrawerTitle className="sr-only">Navigation Menu</DrawerTitle>
									<ThemeToggle />
								</DrawerHeader>
								<div className="flex flex-col py-2">
									{mainNavLinks.map((link) => (
										<DrawerClose key={link.to} asChild>
											<MobileNavLink
												{...link}
												isActive={isRouteActive(link.to)}
												onClick={closeMobileMenu}
											/>
										</DrawerClose>
									))}
									<DrawerClose asChild>
										<MobileNavLink
											to="/settings"
											label="Settings"
											isActive={isRouteActive("/settings")}
											onClick={closeMobileMenu}
										/>
									</DrawerClose>
									{isAdmin && (
										<>
											<div className="my-2 border-t" />
											<div className="px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
												Admin
											</div>
											{adminNavLinks.map((link) => (
												<DrawerClose key={link.to} asChild>
													<MobileNavLink
														{...link}
														isActive={isRouteActive(link.to)}
														onClick={closeMobileMenu}
													/>
												</DrawerClose>
											))}
										</>
									)}
								</div>
							</DrawerContent>
						</Drawer>
					</div>

					{/* Logo - centered on mobile, left on desktop */}
					<Link
						to="/"
						className="flex items-center justify-self-center transition-opacity hover:opacity-80 md:min-w-32"
					>
						<NounceLogo height={22} />
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
					<div className="flex min-w-[40px] items-center justify-end justify-self-end gap-2 md:gap-4 md:min-w-32">
						{/* Desktop only: Theme toggle and Settings */}
						<div className="hidden md:flex md:items-center md:gap-2">
							<ThemeToggle />
							<Button variant="ghost" size="icon" asChild className="size-9">
								<Link to="/settings">
									<RiSettings3Line size={20} />
								</Link>
							</Button>
						</div>

						{/* User button - always visible */}
						<SignedIn>
							<UserButton
								appearance={{
									elements: {
										avatarBox: "size-8",
									},
								}}
							/>
						</SignedIn>
						<SignedOut>
							<Button variant="default" size="sm" asChild>
								<SignInButton />
							</Button>
						</SignedOut>
					</div>
				</div>
			</nav>
		</header>
	);
}
