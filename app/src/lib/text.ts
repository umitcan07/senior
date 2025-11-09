import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getTexts, insertText, updateText, deleteText } from '@/db/text';

const TextSchema = z.object({
	text: z.string().min(1),
});

const UpdateTextSchema = z.object({
	id: z.number().int().positive(),
	text: z.string().min(1),
});

const DeleteTextSchema = z.object({
	id: z.number().int().positive(),
});

export const serverInsertText = createServerFn({ method: 'POST' })
	.inputValidator(TextSchema)
	.handler(async ({ data }) => {
		try {
			const result = await insertText({ text: data.text });
			return { success: true, data: result };
		} catch (error) {
			return { success: false, error: 'An error occurred while inserting the text' };
		}
	});

export const serverGetTexts = createServerFn({ method: 'GET' }).handler(async () => {
	try {
		const result = await getTexts();
		return { success: true, data: result };
	} catch (error) {
		return { success: false, error: 'An error occurred while getting the texts' };
	}
});

export const serverUpdateText = createServerFn({ method: 'POST' })
	.inputValidator(UpdateTextSchema)
	.handler(async ({ data }) => {
		try {
			const result = await updateText(data.id, { text: data.text });
			return { success: true, data: result };
		} catch (error) {
			return { success: false, error: 'An error occurred while updating the text' };
		}
	});

export const serverDeleteText = createServerFn({ method: 'POST' })
	.inputValidator(DeleteTextSchema)
	.handler(async ({ data }) => {
		try {
			await deleteText(data.id);
			return { success: true };
		} catch (error) {
			return { success: false, error: 'An error occurred while deleting the text' };
		}
	});