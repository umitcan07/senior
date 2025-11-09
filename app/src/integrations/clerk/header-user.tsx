import { Button } from "@/components/ui/button";
import { NonceLogo } from "@/components/ui/nonce";
import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";

export default function HeaderUser() {
	return (
		<>
			<SignedIn>
				<header className="flex items-center justify-end border-b border-slate-100">
					<div className="container max-w-7xl md:px-10 px-6 mx-auto py-5">
						<div className="flex items-center justify-between gap-2">
							<Link to="/">
								<NonceLogo
									className="text-teal-400 hover:text-teal-500 transition-colors"
									size="md"
								/>
							</Link>
							<UserButton />
						</div>
					</div>
				</header>
			</SignedIn>
			<SignedOut>
				<header className="flex items-center justify-end border-b border-slate-100">
					<div className="container max-w-7xl md:px-10 px-6 mx-auto py-5">
						<div className="flex items-center justify-between gap-2">
							<Link to="/">
								<NonceLogo
									className="text-slate-400 hover:text-teal-500 transition-colors"
									size="md"
								/>
							</Link>
							<Button variant="outline" size="sm" asChild>
								<SignInButton />
							</Button>
						</div>
					</div>
				</header>
			</SignedOut>
		</>
	);
}
