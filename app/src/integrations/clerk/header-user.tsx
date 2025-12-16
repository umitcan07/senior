import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { NonceLogo } from "@/components/ui/nonce";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function HeaderUser() {
	return (
		<>
			<header className="flex items-center justify-end border-zinc-100 border-b dark:border-zinc-800">
				<div className="container mx-auto max-w-7xl px-6 py-5 md:px-10">
					<div className="flex items-center justify-between gap-2">
						<Link to="/">
							<NonceLogo height={24} />
						</Link>
						<div className="flex items-center gap-2">
							<ThemeToggle />
							<div className="w-7">
								<SignedIn>
									<UserButton />
								</SignedIn>
								<SignedOut>
									<Button variant="default" size="sm" asChild>
										<SignInButton />
									</Button>
								</SignedOut>
							</div>
						</div>
					</div>
				</div>
			</header>
		</>
	);
}
