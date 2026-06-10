import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
	useUser,
} from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NounceLogo } from "@/components/ui/nounce";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UpgradeAccountDialog } from "@/components/upgrade-account-dialog";

/** Signed-in slot: guests get a "Save progress" CTA (they're technically signed in
 * but anonymous); real accounts get the normal UserButton. */
function SignedInSlot() {
	const { user } = useUser();
	const [upgradeOpen, setUpgradeOpen] = useState(false);
	const isGuest = user?.publicMetadata?.guest === true;

	if (!isGuest) return <UserButton />;

	return (
		<>
			<Button size="sm" variant="default" onClick={() => setUpgradeOpen(true)}>
				Save progress
			</Button>
			<UpgradeAccountDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
		</>
	);
}

export default function HeaderUser() {
	return (
		<header className="flex items-center justify-end border-zinc-100 border-b dark:border-zinc-800">
			<div className="container mx-auto max-w-7xl px-6 py-5 md:px-10">
				<div className="flex items-center justify-between gap-2">
					<Link to="/">
						<NounceLogo height={24} />
					</Link>
					<div className="flex items-center gap-2">
						<ThemeToggle />
						<SignedIn>
							<SignedInSlot />
						</SignedIn>
						<SignedOut>
							<div className="w-7">
								<Button variant="default" size="sm" asChild>
									<SignInButton />
								</Button>
							</div>
						</SignedOut>
					</div>
				</div>
			</div>
		</header>
	);
}
