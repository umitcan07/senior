import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getTexts, getTextById, insertText, updateText, deleteText } from '@/db/text';
import { ErrorCode, createErrorResponse, createSuccessResponse } from './errors';
import type { ApiResponse } from './errors';
import type { Text } from '@/db/text';

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
	.handler(async ({ data }): Promise<ApiResponse<Text>> => {
		try {
			const result = await insertText({ text: data.text });
			return createSuccessResponse(result);
		} catch (error) {
			console.error('Insert text error:', error);
			
			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					'Invalid input data',
					{ errors: error.errors },
					400,
				);
			}

			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					'An error occurred while inserting the text',
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				'An error occurred while inserting the text',
				undefined,
				500,
			);
		}
	});

export const serverGetTexts = createServerFn({ method: 'GET' }).handler(async (): Promise<ApiResponse<Text[]>> => {
	try {
		const result = await getTexts();
		return createSuccessResponse(result);
	} catch (error) {
		console.error('Get texts error:', error);

		if (error instanceof Error) {
			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				'An error occurred while getting the texts',
				{ originalError: error.message },
				500,
			);
		}

		return createErrorResponse(
			ErrorCode.DATABASE_ERROR,
			'An error occurred while getting the texts',
			undefined,
			500,
		);
	}
});

const GetTextByIdSchema = z.object({
	id: z.number().int().positive(),
});

export const serverGetTextById = createServerFn({ method: 'GET' })
	.inputValidator(GetTextByIdSchema)
	.handler(async ({ data }): Promise<ApiResponse<Text | null>> => {
		try {
			const result = await getTextById(data.id);
			return createSuccessResponse(result);
		} catch (error) {
			console.error('Get text by id error:', error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					'Invalid input data',
					{ errors: error.errors },
					400,
				);
			}

			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					'An error occurred while getting the text',
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				'An error occurred while getting the text',
				undefined,
				500,
			);
		}
	});

export const serverUpdateText = createServerFn({ method: 'POST' })
	.inputValidator(UpdateTextSchema)
	.handler(async ({ data }): Promise<ApiResponse<Text>> => {
		try {
			const result = await updateText(data.id, { text: data.text });
			return createSuccessResponse(result);
		} catch (error) {
			console.error('Update text error:', error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					'Invalid input data',
					{ errors: error.errors },
					400,
				);
			}

			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					'An error occurred while updating the text',
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				'An error occurred while updating the text',
				undefined,
				500,
			);
		}
	});

export const serverDeleteText = createServerFn({ method: 'POST' })
	.inputValidator(DeleteTextSchema)
	.handler(async ({ data }): Promise<ApiResponse<void>> => {
		try {
			await deleteText(data.id);
			return createSuccessResponse(undefined);
		} catch (error) {
			console.error('Delete text error:', error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					'Invalid input data',
					{ errors: error.errors },
					400,
				);
			}

			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					'An error occurred while deleting the text',
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				'An error occurred while deleting the text',
				undefined,
				500,
			);
		}
	});