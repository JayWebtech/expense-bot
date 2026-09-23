export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class AIProviderError extends AppError {
  constructor(message: string) {
    super(message, 'AI_PROVIDER_ERROR', 502);
  }
}

export class TelegramError extends AppError {
  constructor(message: string) {
    super(message, 'TELEGRAM_ERROR', 500);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500);
  }
}

export class ExportError extends AppError {
  constructor(message: string) {
    super(message, 'EXPORT_ERROR', 500);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT_ERROR', 429);
  }
}

export class DuplicateTransactionError extends AppError {
  constructor() {
    super('Potential duplicate transaction detected', 'DUPLICATE_TRANSACTION', 409);
  }
}

export class VoiceTranscriptionError extends AppError {
  constructor(message: string) {
    super(message, 'VOICE_TRANSCRIPTION_ERROR', 500);
  }
}
