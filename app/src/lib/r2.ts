import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ApiResponse } from "./errors";
import {
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

if (!process.env.R2_ACCOUNT_ID) {
	throw new Error("R2_ACCOUNT_ID environment variable is not set");
}

if (!process.env.R2_ACCESS_KEY_ID) {
	throw new Error("R2_ACCESS_KEY_ID environment variable is not set");
}

if (!process.env.R2_SECRET_ACCESS_KEY) {
	throw new Error("R2_SECRET_ACCESS_KEY environment variable is not set");
}

if (!process.env.R2_BUCKET_NAME) {
	throw new Error("R2_BUCKET_NAME environment variable is not set");
}

if (!process.env.R2_ENDPOINT) {
	throw new Error("R2_ENDPOINT environment variable is not set");
}

const s3Client = new S3Client({
	region: "auto",
	endpoint: process.env.R2_ENDPOINT,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
	},
});

export async function uploadToR2(
	file: Buffer,
	key: string,
	contentType: string,
): Promise<ApiResponse<{ url: string; key: string }>> {
	try {
		const command = new PutObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME!,
			Key: key,
			Body: file,
			ContentType: contentType,
		});

		await s3Client.send(command);

		const publicUrl = `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${key}`;

		return createSuccessResponse({
			url: publicUrl,
			key,
		});
	} catch (error) {
		console.error("R2 upload error:", error);

		if (error instanceof Error) {
			return createErrorResponse(
				ErrorCode.R2_UPLOAD_ERROR,
				"Failed to upload file to storage",
				{ originalError: error.message },
				500,
			);
		}

		return createErrorResponse(
			ErrorCode.R2_UPLOAD_ERROR,
			"Failed to upload file to storage",
			undefined,
			500,
		);
	}
}
