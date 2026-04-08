
export type ApiResponse<T = void> = {
    success: boolean;
    message: string;
    data?: T;
    errors?: Record<string, string[]>; // Field validation errors
};

