import { validationResult } from 'express-validator';
import ApiResponse from '../utils/ApiResponse.js';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(422).json(
      ApiResponse.validationError('Validation failed', errorMessages)
    );
  }
  
  next();
};

export default validate; 