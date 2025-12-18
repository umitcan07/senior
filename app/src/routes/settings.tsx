import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { type Author, MOCK_AUTHORS } from "@/data/mock";
import { useToast } from "@/hooks/use-toast";

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
	loader: async () => {
		// In production, fetch user preferences and available authors from database
		return {
			authors: MOCK_AUTHORS,
			currentPreferredAuthorId: MOCK_AUTHORS[0]?.id ?? null,
		};
	},
	pendingComponent: SettingsSkeleton,
});

// ============================================================================
// SETTINGS SECTION
// ============================================================================

interface SettingsSectionProps {
	title: string;
	description?: string;
	children: React.ReactNode;
}

function SettingsSection({
	title,
	description,
	children,
}: SettingsSectionProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

// ============================================================================
// AUTHOR SELECTOR
// ============================================================================

interface AuthorSelectorProps {
	authors: Author[];
	selectedAuthorId: string | null;
	onSelect: (authorId: string) => void;
	isLoading?: boolean;
}

function AuthorSelector({
	authors,
	selectedAuthorId,
	onSelect,
	isLoading,
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
			disabled={isLoading}
		>
			<SelectTrigger className="w-full max-w-xs">
				<SelectValue placeholder="Select a voice" />
			</SelectTrigger>
			<SelectContent>
				{authors.map((author) => (
					<SelectItem key={author.id} value={author.id}>
						<div className="flex items-center gap-2">
							<span>{author.name}</span>
							<Badge variant="secondary" className="text-xs">
								{author.accent}
							</Badge>
							<span className="text-muted-foreground text-xs">
								{author.style}
							</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

// ============================================================================
// SKELETON
// ============================================================================

function SettingsSkeleton() {
	return (
		<MainLayout>
			<PageContainer maxWidth="md">
				<div className="space-y-8">
					<div className="space-y-2">
						<Skeleton className="h-8 w-32" />
						<Skeleton className="h-4 w-64" />
					</div>
					<Skeleton className="h-40" />
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// ============================================================================
// GUEST VIEW
// ============================================================================

function GuestSettings() {
	return (
		<MainLayout>
			<PageContainer maxWidth="full">
				<div className="space-y-8">
					<PageHeader title="Settings" description="Manage your preferences" />

					<Card className="bg-muted/30">
						<CardContent className="flex flex-col items-center gap-4 py-12 text-center">
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

// ============================================================================
// MAIN PAGE
// ============================================================================

function SettingsPage() {
	const { authors, currentPreferredAuthorId } = Route.useLoaderData();
	const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(
		currentPreferredAuthorId,
	);
	const [isSaving, setIsSaving] = useState(false);
	const { toast } = useToast();

	const handleAuthorSelect = async (authorId: string) => {
		setSelectedAuthorId(authorId);
		setIsSaving(true);

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 500));

		setIsSaving(false);
		toast({
			title: "Preferences saved",
			description: "Your preferred voice has been updated.",
		});
	};

	return (
		<>
			<SignedOut>
				<GuestSettings />
			</SignedOut>
			<SignedIn>
				<MainLayout>
					<PageContainer maxWidth="md">
						<div className="space-y-8">
							<PageHeader
								title="Settings"
								description="Manage your preferences"
							/>

							<SettingsSection
								title="Preferred Voice"
								description="Choose your default reference voice for practice sessions. This voice will be pre-selected when you start a new practice."
							>
								<AuthorSelector
									authors={authors}
									selectedAuthorId={selectedAuthorId}
									onSelect={handleAuthorSelect}
									isLoading={isSaving}
								/>
								{isSaving && (
									<p className="mt-2 text-muted-foreground text-xs">
										Saving...
									</p>
								)}
							</SettingsSection>

							<SettingsSection
								title="Account"
								description="Manage your account settings and profile."
							>
								<p className="text-muted-foreground text-sm">
									Account settings are managed through your authentication
									provider. Click on your profile picture in the navigation bar
									to access account settings.
								</p>
							</SettingsSection>

							<SettingsSection
								title="Appearance"
								description="Customize how the app looks and feels."
							>
								<p className="text-muted-foreground text-sm">
									Use the theme toggle in the navigation bar to switch between
									light and dark mode. Your preference is saved automatically.
								</p>
							</SettingsSection>
						</div>
					</PageContainer>
				</MainLayout>
			</SignedIn>
		</>
	);
}
