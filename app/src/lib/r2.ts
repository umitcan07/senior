import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
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
			Bucket: process.env.R2_BUCKET_NAME,
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

/**
 * Check if a file exists in R2 storage
 */
export async function existsInR2(key: string): Promise<ApiResponse<boolean>> {
	const bucketName = process.env.R2_BUCKET_NAME;
	if (!bucketName) {
		return createErrorResponse(
			ErrorCode.R2_UPLOAD_ERROR,
			"R2_BUCKET_NAME is not configured",
			undefined,
			500,
		);
	}

	try {
		const command = new HeadObjectCommand({
			Bucket: bucketName,
			Key: key,
		});

		await s3Client.send(command);
		return createSuccessResponse(true);
	} catch (error: unknown) {
		// If the error is a 404, the file doesn't exist
		if (
			error &&
			typeof error === "object" &&
			"$metadata" in error &&
			typeof error.$metadata === "object" &&
			error.$metadata !== null &&
			"httpStatusCode" in error.$metadata &&
			error.$metadata.httpStatusCode === 404
		) {
			return createSuccessResponse(false);
		}

		console.error("R2 exists check error:", error);

		if (error instanceof Error) {
			return createErrorResponse(
				ErrorCode.R2_UPLOAD_ERROR,
				"Failed to check file existence in storage",
				{ originalError: error.message },
				500,
			);
		}

		return createErrorResponse(
			ErrorCode.R2_UPLOAD_ERROR,
			"Failed to check file existence in storage",
			undefined,
			500,
		);
	}
}

/**
 * Retrieve a file from R2 storage
 */
export async function getFromR2(
	key: string,
): Promise<ApiResponse<{ data: Buffer; contentType: string }>> {
	const bucketName = process.env.R2_BUCKET_NAME;
	if (!bucketName) {
		return createErrorResponse(
			ErrorCode.R2_UPLOAD_ERROR,
			"R2_BUCKET_NAME is not configured",
			undefined,
			500,
		);
	}

	try {
		const command = new GetObjectCommand({
			Bucket: bucketName,
			Key: key,
		});

		const response = await s3Client.send(command);

		if (!response.Body) {
			return createErrorResponse(
				ErrorCode.R2_UPLOAD_ERROR,
				"File not found in storage",
				undefined,
				404,
			);
		}

		const arrayBuffer = await response.Body.transformToByteArray();
		const buffer = Buffer.from(arrayBuffer);
		const contentType = response.ContentType || "application/octet-stream";

		return createSuccessResponse({
			data: buffer,
			contentType,
		});
	} catch (error) {
		console.error("R2 get error:", error);

		if (error instanceof Error) {
			return createErrorResponse(
				ErrorCode.R2_UPLOAD_ERROR,
				"Failed to retrieve file from storage",
				{ originalError: error.message },
				500,
			);
		}

		return createErrorResponse(
			ErrorCode.R2_UPLOAD_ERROR,
			"Failed to retrieve file from storage",
			undefined,
			500,
		);
	}
}

/**
 * Generate a public URL for an R2 object
 */
export function getPublicUrl(key: string): string {
	if (process.env.R2_PUBLIC_URL) {
		// R2_PUBLIC_URL should be the base URL, e.g., https://pub-xxx.r2.dev
		// It might or might not include trailing slash
		const baseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, "");
		// R2 public URLs for "dev" buckets usually map directly to the bucket contents
		// so we append the key directly.
		// NOTE: Ensure the key does not start with / if we handled the trailing slash
		const cleanKey = key.startsWith("/") ? key.slice(1) : key;
		return `${baseUrl}/${cleanKey}`;
	}
	
	// Fallback to S3 endpoint (which likely fails for public access without auth)
	return `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${key}`;
}
