class ApiResponse {
  constructor(statusCode = 200, data = null, message = 'Success', success = true) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
  }

  static success(data = null, message = 'Success', statusCode = 200) {
    return new ApiResponse(statusCode, data, message, true);
  }

  static error(message = 'Error', statusCode = 500, data = null) {
    return new ApiResponse(statusCode, data, message, false);
  }

  static created(data = null, message = 'Created successfully') {
    return new ApiResponse(201, data, message, true);
  }

  static noContent(message = 'No content') {
    return new ApiResponse(204, null, message, true);
  }

  static badRequest(message = 'Bad request', data = null) {
    return new ApiResponse(400, data, message, false);
  }

  static unauthorized(message = 'Unauthorized', data = null) {
    return new ApiResponse(401, data, message, false);
  }

  static forbidden(message = 'Forbidden', data = null) {
    return new ApiResponse(403, data, message, false);
  }

  static notFound(message = 'Not found', data = null) {
    return new ApiResponse(404, data, message, false);
  }

  static conflict(message = 'Conflict', data = null) {
    return new ApiResponse(409, data, message, false);
  }

  static validationError(message = 'Validation error', data = null) {
    return new ApiResponse(422, data, message, false);
  }

  static internalError(message = 'Internal server error', data = null) {
    return new ApiResponse(500, data, message, false);
  }
}

export default ApiResponse; 