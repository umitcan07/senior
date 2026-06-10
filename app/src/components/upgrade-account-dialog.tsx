import { useUser } from "@clerk/tanstack-react-start";
import { RiCheckLine } from "@remixicon/react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { clearGuestFlag } from "@/lib/guest-auth";

/**
 * "Save your progress" — upgrades the current guest user in place by adding a real
 * email (verified with an email code) + password. Because we add credentials to the
 * SAME Clerk user, the `userId` never changes, so all guest history (recordings,
 * analyses, preferences) is preserved automatically — no data migration. Finally we
 * clear `publicMetadata.guest` server-side so the trial limit and header CTA lift.
 */
export function UpgradeAccountDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { user } = useUser();
	const { toast } = useToast();

	const [step, setStep] = useState<"form" | "verify">("form");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function reset() {
		setStep("form");
		setEmail("");
		setPassword("");
		setCode("");
		setError(null);
		setBusy(false);
	}

	function handleOpenChange(next: boolean) {
		if (!next) reset();
		onOpenChange(next);
	}

	async function handleStartUpgrade(e: FormEvent) {
		e.preventDefault();
		if (!user) return;
		setBusy(true);
		setError(null);
		try {
			const emailObj = await user.createEmailAddress({ email });
			await emailObj.prepareVerification({ strategy: "email_code" });
			setStep("verify");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Couldn't start verification. Try a different email.",
			);
		} finally {
			setBusy(false);
		}
	}

	async function handleVerify(e: FormEvent) {
		e.preventDefault();
		if (!user) return;
		setBusy(true);
		setError(null);
		try {
			const emailObj = user.emailAddresses.find(
				(a) => a.emailAddress === email,
			);
			if (!emailObj)
				throw new Error("Email address not found on this account.");

			const verified = await emailObj.attemptVerification({ code });
			if (verified.verification.status !== "verified") {
				throw new Error("That code didn't match. Please try again.");
			}

			await user.update({ primaryEmailAddressId: emailObj.id });
			if (password) await user.updatePassword({ newPassword: password });
			await clearGuestFlag();
			await user.reload();

			toast({
				variant: "success",
				title: "Account saved",
				description: "Your progress is now tied to your account.",
			});
			handleOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Verification failed. Try again.",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Save your progress</DialogTitle>
					<DialogDescription>
						{step === "form"
							? "Add an email and password to keep your practice history and unlock unlimited analyses."
							: `Enter the 6-digit code we sent to ${email}.`}
					</DialogDescription>
				</DialogHeader>

				{step === "form" ? (
					<form onSubmit={handleStartUpgrade} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="upgrade-email">Email</Label>
							<Input
								id="upgrade-email"
								type="email"
								required
								autoComplete="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="upgrade-password">Password</Label>
							<Input
								id="upgrade-password"
								type="password"
								required
								minLength={8}
								autoComplete="new-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="At least 8 characters"
							/>
						</div>
						{error && <p className="text-destructive text-sm">{error}</p>}
						<DialogFooter>
							<Button type="submit" disabled={busy} className="w-full">
								{busy ? "Sending code…" : "Continue"}
							</Button>
						</DialogFooter>
					</form>
				) : (
					<form onSubmit={handleVerify} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="upgrade-code">Verification code</Label>
							<Input
								id="upgrade-code"
								inputMode="numeric"
								required
								autoComplete="one-time-code"
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder="123456"
							/>
						</div>
						{error && <p className="text-destructive text-sm">{error}</p>}
						<DialogFooter className="flex-col gap-2 sm:flex-col">
							<Button type="submit" disabled={busy} className="w-full gap-2">
								<RiCheckLine size={16} />
								{busy ? "Verifying…" : "Save account"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={busy}
								onClick={() => {
									setStep("form");
									setError(null);
								}}
							>
								Use a different email
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
