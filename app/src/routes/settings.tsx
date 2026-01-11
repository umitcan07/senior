import {
	SignedIn,
	SignedOut,
	SignInButton,
	useUser,
} from "@clerk/tanstack-react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { RiComputerLine, RiMicLine, RiUserLine } from "@remixicon/react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { pageVariants } from "@/components/ui/animations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { Spinner } from "@/components/ui/spinner";
import type { Author } from "@/db/types";
import { useToast } from "@/hooks/use-toast";
import { serverGetAuthors } from "@/lib/author";
import {
	serverGetPreferredAuthorId,
	serverUpdateUserPreferences,
} from "@/lib/user-preferences";

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
	loader: async () => {
		// Check authentication before calling server functions
		let isAuthenticated = false;
		let userId: string | null = null;
		try {
			const authResult = await auth();
			isAuthenticated = authResult.isAuthenticated ?? false;
			userId = authResult.userId ?? null;
		} catch (error) {
			// Auth context not available - treat as unauthenticated
			console.warn("Auth not available in settings loader:", error);
		}

		if (!isAuthenticated || !userId) {
			// Return default values if not authenticated
			const authorsResult = await serverGetAuthors();
			const authors = authorsResult.success ? authorsResult.data : [];
			return {
				authors,
				currentPreferredAuthorId: null,
			};
		}

		const [authorsResult, preferredAuthorIdResult] = await Promise.all([
			serverGetAuthors(),
			serverGetPreferredAuthorId(),
		]);

		const authors = authorsResult.success ? authorsResult.data : [];
		const preferredAuthorId = preferredAuthorIdResult ?? authors[0]?.id ?? null;

		return {
			authors,
			currentPreferredAuthorId: preferredAuthorId,
		};
	},
	pendingComponent: SettingsSkeleton,
});

// SETTINGS SECTION

interface SettingsSectionProps {
	title: string;
	description?: string;
	icon?: React.ReactNode;
	children: React.ReactNode;
}

function SettingsSection({
	title,
	description,
	icon,
	children,
}: SettingsSectionProps) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				{icon && <div className="text-muted-foreground">{icon}</div>}
				<h2 className="font-semibold text-base">{title}</h2>
			</div>
			{description && (
				<p className="text-muted-foreground text-sm">{description}</p>
			)}
			{children}
		</div>
	);
}

// AUTHOR SELECTOR

interface AuthorSelectorProps {
	authors: Author[];
	selectedAuthorId: string | null;
	onSelect: (authorId: string) => void;
	disabled?: boolean;
}

function AuthorSelector({
	authors,
	selectedAuthorId,
	onSelect,
	disabled,
}: AuthorSelectorProps) {
	if (authors.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No voices available. Please check back later.
			</p>
		);
	}

	return (
		<Select
			value={selectedAuthorId ?? undefined}
			onValueChange={onSelect}
			disabled={disabled}
		>
			<SelectTrigger className="w-full sm:max-w-xs">
				<SelectValue placeholder="Select a voice">
					{selectedAuthorId
						? authors.find((a) => a.id === selectedAuthorId)?.name
						: "Select a voice"}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{authors.map((author) => (
					<SelectItem key={author.id} value={author.id} textValue={author.name}>
						<div className="flex flex-col gap-0.5">
							<span className="font-medium">{author.name}</span>
							<span className="text-muted-foreground text-xs">
								{author.accent} • {author.style}
							</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

// Loading state

function SettingsSkeleton() {
	return (
		<MainLayout>
			<PageContainer maxWidth="md">
				<div className="flex min-h-64 flex-col items-center justify-center">
					<ShimmeringText
						text="Loading settings..."
						className="text-lg"
						duration={1.5}
					/>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// GUEST VIEW

function GuestSettings() {
	return (
		<MainLayout>
			<PageContainer maxWidth="full">
				<div className="flex flex-col gap-8">
					<PageHeader title="Settings" description="Manage your preferences" />

					<Card className="bg-muted/30">
						<CardContent className="flex flex-col items-center gap-4 py-8 text-center md:py-12">
							<div className="flex flex-col gap-2">
								<h2 className="font-medium text-lg">
									Sign in to access settings
								</h2>
								<p className="max-w-md text-muted-foreground text-sm">
									Save your preferences and customize your learning experience.
								</p>
							</div>
							<Button asChild>
								<SignInButton mode="modal">Sign in</SignInButton>
							</Button>
						</CardContent>
					</Card>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// MAIN PAGE

function SettingsPage() {
	const { authors, currentPreferredAuthorId: initialAuthorId } =
		Route.useLoaderData();
	const { user } = useUser();
	const [savedAuthorId, setSavedAuthorId] = useState<string | null>(
		initialAuthorId,
	);
	const [pendingAuthorId, setPendingAuthorId] = useState<string | null>(
		initialAuthorId,
	);
	const [isSaving, setIsSaving] = useState(false);
	const { toast } = useToast();

	const hasChanges = pendingAuthorId !== savedAuthorId;

	const handleSave = async () => {
		if (!user?.id) {
			toast({
				title: "Authentication required",
				description: "Please sign in to save preferences.",
				variant: "destructive",
			});
			return;
		}

		setIsSaving(true);

		try {
			const result = await serverUpdateUserPreferences({
				data: {
					userId: user.id,
					preferredAuthorId: pendingAuthorId,
				},
			});

			if (!result.success) {
				toast({
					title: "Failed to save preferences",
					description: result.error.message,
					variant: "destructive",
				});
				return;
			}

			setSavedAuthorId(pendingAuthorId);
			toast({
				title: "Preferences saved",
				description: "Your preferred voice has been updated.",
			});
		} catch (error) {
			console.error("Save preferences error:", error);
			toast({
				title: "Failed to save preferences",
				description: "An unexpected error occurred. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		setPendingAuthorId(savedAuthorId);
	};

	return (
		<>
			<SignedOut>
				<GuestSettings />
			</SignedOut>
			<SignedIn>
				<MainLayout>
					<motion.div
						variants={pageVariants}
						initial="initial"
						animate="animate"
						exit="exit"
					>
						<PageContainer maxWidth="md">
							<div className="flex flex-col gap-12">
								<PageHeader
									title="Settings"
									description="Manage your preferences"
								/>

								<div className="flex flex-col gap-12">
									<SettingsSection
										title="Preferred Voice"
										description="Choose your default reference voice for practice sessions. This voice will be pre-selected when you start a new practice."
										icon={<RiMicLine className="size-5" />}
									>
										<div className="flex flex-col gap-4 sm:flex-row">
											<AuthorSelector
												authors={authors}
												selectedAuthorId={pendingAuthorId}
												onSelect={setPendingAuthorId}
												disabled={isSaving}
											/>
											{hasChanges && (
												<div className="flex gap-2">
													<Button
														onClick={handleSave}
														disabled={isSaving}
														className="flex-1"
													>
														{isSaving && (
															<Spinner className="size-4 text-primary-foreground" />
														)}
														Save
													</Button>
													<Button
														onClick={handleCancel}
														disabled={isSaving}
														variant="outline"
														className="flex-1"
													>
														Cancel
													</Button>
												</div>
											)}
										</div>
									</SettingsSection>

									<div className="border-t" />

									<SettingsSection
										title="Appearance"
										description="Customize how the app looks and feels."
										icon={<RiComputerLine className="size-5" />}
									>
										<p className="text-muted-foreground text-sm">
											Use the theme toggle in the navigation bar to switch
											between light and dark mode. Your preference is saved
											automatically.
										</p>
									</SettingsSection>

									<div className="border-t" />
									<SettingsSection
										title="Account"
										icon={<RiUserLine className="size-5" />}
									>
										<p className="text-muted-foreground text-sm">
											Click on your profile picture in the navigation bar to
											access account settings.
										</p>
									</SettingsSection>
								</div>
							</div>
						</PageContainer>
					</motion.div>
				</MainLayout>
			</SignedIn>
		</>
	);
}
