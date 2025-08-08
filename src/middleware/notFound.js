import ApiResponse from '../utils/ApiResponse.js';

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404).json(ApiResponse.notFound(`Route ${req.originalUrl} not found`));
};

export default notFound; 