import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import type { AnyFieldApi } from '@tanstack/react-form';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { serverInsertText, serverGetTexts, serverUpdateText, serverDeleteText } from '@/lib/text';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/admin/text')({
	component: RouteComponent,
	loader: async () => {
		const result = await serverGetTexts();
		if (!result.success) {
			throw new Error(result.error);
		}
		return { texts: result.data };
	},
});

function FieldInfo({ field }: { field: AnyFieldApi }) {
	if (!field.state.meta.isTouched) return null;
	
	return (
		<div className="text-xs text-muted-foreground mt-1">
			{!field.state.meta.isValid && field.state.meta.errors.length > 0 ? (
				<span className="text-destructive">{field.state.meta.errors.join(', ')}</span>
			) : field.state.meta.isValidating ? (
				<span>Validating...</span>
			) : null}
		</div>
	);
}

function TextItem({ text }: { text: { id: number; text: string } }) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(text.text);
	const updateTextFn = useServerFn(serverUpdateText);
	const deleteTextFn = useServerFn(serverDeleteText);
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!isEditing) {
			setEditValue(text.text);
		}
	}, [text.text, isEditing]);

	const { mutate: updateText, isPending: isUpdating } = useMutation({
		mutationFn: async (data: { id: number; text: string }) => {
			return updateTextFn({ data });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['texts'] });
			setIsEditing(false);
		},
	});

	const { mutate: deleteText, isPending: isDeleting } = useMutation({
		mutationFn: async (id: number) => {
			return deleteTextFn({ data: { id } });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['texts'] });
		},
	});

	const handleSave = () => {
		if (editValue.trim() && editValue !== text.text) {
			updateText({ id: text.id, text: editValue.trim() });
		} else {
			setIsEditing(false);
		}
	};

	const handleCancel = () => {
		setEditValue(text.text);
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || e.key === 'Escape') {
			e.preventDefault();
			if (e.key === 'Escape') {
				handleCancel();
			} else {
				handleSave();
			}
		}
	};

	if (isEditing) {
		return (
			<li className="flex flex-col gap-2 p-4 border rounded-lg bg-card">
				<Textarea
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onKeyDown={handleKeyDown}
					className="min-h-24 resize-none"
					autoFocus
				/>
				<div className="flex gap-2 justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleCancel}
						disabled={isUpdating}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={handleSave}
						disabled={isUpdating || !editValue.trim()}
					>
						{isUpdating ? 'Saving...' : 'Save'}
					</Button>
				</div>
			</li>
		);
	}

	return (
		<li className="group flex flex-col gap-2 p-4 border rounded-lg bg-card hover:border-ring/50 transition-colors">
			<p className="text-sm whitespace-pre-wrap wrap-break-word flex-1">{text.text}</p>
			<div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setIsEditing(true)}
					disabled={isDeleting}
				>
					Edit
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => deleteText(text.id)}
					disabled={isDeleting}
					className="text-destructive hover:text-destructive"
				>
					Delete
				</Button>
			</div>
		</li>
	);
}

function TextList() {
	const getTextsFn = useServerFn(serverGetTexts);
	const loaderData = Route.useLoaderData();

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ['texts'],
		queryFn: async () => {
			const result = await getTextsFn();
			if (!result.success) {
				throw new Error(result.error);
			}
			return result.data;
		},
		initialData: loaderData.texts,
	});

	if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
	if (isError) return <div className="text-destructive">Error: {error?.message}</div>;
	if (data && data.length > 0) {
		return (
			<div>
				<h2 className="text-lg font-semibold mb-4">Texts ({data.length})</h2>
				<ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{data.map((text) => (
						<TextItem key={text.id} text={text} />
					))}
				</ul>
			</div>
		);
	}
	if (data && data.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				<p>No texts yet. Add one below.</p>
			</div>
		);
	}
	return null;
}

function TextForm() {
	const insertTextFn = useServerFn(serverInsertText);
	const queryClient = useQueryClient();

	const { mutate } = useMutation({
		mutationFn: async (data: { text: string }) => {
			return insertTextFn({ data });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['texts'] });
		},
	});

	const form = useForm({
		defaultValues: {
			text: '',
		},
		onSubmit: async ({ value }) => {
			mutate(value, {
				onSuccess: () => {
					form.reset();
				},
			});
		},
	});
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<div className="space-y-2">
				<Label htmlFor="text">Add New Text</Label>
				<form.Field
					name="text"
					validators={{
						onChange: ({ value }) =>
							!value
								? "Text is required"
								: value.length < 3
									? "Text must be at least 3 characters"
									: undefined,
						onChangeAsyncDebounceMs: 500,
						onChangeAsync: async ({ value }) => {
							await new Promise((resolve) => setTimeout(resolve, 1000));
							return (
								value.includes("error") &&
								'No "error" allowed in text'
							)
						},
					}}
					// biome-ignore lint/correctness/noChildrenProp: <explanation>
					children={(field) => {
						return (
							<>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Enter your text here..."
									className="min-h-24 resize-none"
								/>
								<FieldInfo field={field} />
							</>
						)
					}}
				/>
			</div>
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
				children={([canSubmit, isSubmitting]) => (
					<Button type="submit" disabled={!canSubmit}>
						{isSubmitting ? "Submitting..." : "Add Text"}
					</Button>
				)}
			/>
		</form>
	)
}

function RouteComponent() {
	return (
		<div className="container max-w-7xl md:px-10 px-6 mx-auto py-8 flex flex-col gap-12">
			<div className="space-y-2">
				<h1 className="text-2xl font-bold">Text Management</h1>
				<p className="text-muted-foreground">Create, edit, and manage your texts</p>
			</div>
			<div className="flex flex-col gap-10">
				<TextList />
				<div className="space-y-4">
					<TextForm />
				</div>
			</div>
		</div>
	);
}
