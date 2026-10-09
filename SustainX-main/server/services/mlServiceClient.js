/**
 * ML Service Client for Node.js
 * Proxies requests to Python ML service
 */
const axios = require('axios');

class MLServiceClient {
  constructor() {
    this.baseURL = process.env.ML_SERVICE_URL || 'http://localhost:8001/api/v1';
    this.timeout = parseInt(process.env.ML_SERVICE_TIMEOUT) || 10000;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error normalization
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const status = error.response.status;
          const message = error.response.data?.message || error.message;
          const err = new Error(message);
          err.status = status;
          err.code = error.response.data?.code || 'ML_SERVICE_ERROR';
          throw err;
        }
        // Network or timeout error
        const err = new Error('ML service unavailable');
        err.status = 503;
        err.code = 'ML_SERVICE_UNAVAILABLE';
        throw err;
      }
    );
  }

  /**
   * Predict bin fill level
   */
  async predictBinFill(request) {
    try {
      const response = await this.client.post('/predict/bin-fill', request);
      return response.data;
    } catch (error) {
      if (error.status === 503) {
        return {
          binId: request.binId,
          currentFill: 0,
          predictions: {},
          horizonMinutes: [],
          modelVersion: 'unavailable',
          modelStatus: 'UNAVAILABLE',
          generatedAt: new Date().toISOString(),
          dataQuality: 'ML_SERVICE_UNAVAILABLE',
          dataPoints: 0,
          timeSpanHours: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Classify waste image
   */
  async classifyWaste(request) {
    try {
      const response = await this.client.post('/predict/waste-classification', request);
      return response.data;
    } catch (error) {
      if (error.status === 503) {
        return {
          predictions: [],
          modelVersion: 'unavailable',
          modelStatus: 'UNAVAILABLE',
          generatedAt: new Date().toISOString(),
          processingTimeMs: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Predict complaint priority
   */
  async predictComplaintPriority(request) {
    try {
      const response = await this.client.post('/predict/complaint-priority', request);
      return response.data;
    } catch (error) {
      if (error.status === 503) {
        return {
          predictedPriority: 'medium',
          confidence: 0.5,
          allProbabilities: { low: 0.25, medium: 0.25, high: 0.25, critical: 0.25 },
          ruleOverride: 'ML service unavailable - using rule-based fallback',
          modelVersion: 'fallback',
          modelStatus: 'UNAVAILABLE',
          generatedAt: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  /**
   * Predict hotspots
   */
  async predictHotspots(request) {
    try {
      const response = await this.client.post('/predict/hotspots', request);
      return response.data;
    } catch (error) {
      if (error.status === 503) {
        return {
          hotspots: [],
          modelVersion: 'unavailable',
          modelStatus: 'UNAVAILABLE',
          generatedAt: new Date().toISOString(),
          timeHorizonHours: request.timeHorizonHours || 24,
          dataQuality: 'ML_SERVICE_UNAVAILABLE',
        };
      }
      throw error;
    }
  }

  /**
   * Get model info
   */
  async getModelInfo(modelName) {
    try {
      const response = await this.client.get(`/models/${modelName}`);
      return response.data;
    } catch (error) {
      if (error.status === 503) {
        return {
          name: modelName,
          version: 'unavailable',
          status: 'UNAVAILABLE',
          description: 'ML service unavailable',
        };
      }
      throw error;
    }
  }

  /**
   * List all models
   */
  async listModels() {
    try {
      const response = await this.client.get('/models');
      return response.data;
    } catch (error) {
      if (error.status === 503) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      return { status: 'unhealthy', service: 'ml-service' };
    }
  }
}

module.exports = new MLServiceClient();