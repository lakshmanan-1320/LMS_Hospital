export interface ApiResponse<T = any> {
  success: boolean;
  timestamp: string;
  data: T;
  message?: string;
}

