const { authenticate, processReading, THRESHOLD } = require('../services/iotService');
const BinData = require('../models/BinData');
const BinReading = require('../models/BinReading');

// @desc    Receive IoT data from ESP32 smart dustbin
// @route   POST /api/iot/data
// @access  Requires valid device credentials unless IOT_ALLOW_PUBLIC_INGEST=true
const processIotData = async (req, res) => {
  try {
    const deviceIdHeader = req.headers['x-device-id'];
    const deviceKeyHeader = req.headers['x-device-key'];

    const device = await authenticate({
      deviceId: deviceIdHeader,
      deviceKey: deviceKeyHeader,
    });

    const result = await processReading({ device, body: req.body });

    if (result.deduplicated) {
      return res.status(409).json({ ...result });
    }
    res.status(201).json(result);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    console.error('[IOT ERROR]:', err.message);
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Get latest bin data (most recent reading per bin)
// @route   GET /api/iot/data
// @access  Public
const getIotData = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const binFilter = {};
    if (req.query.binId) binFilter.binId = String(req.query.binId).trim();
    if (req.query.block) binFilter.block = String(req.query.block).toUpperCase();

    const latestBins = await BinData.aggregate([
      ...(Object.keys(binFilter).length ? [{ $match: binFilter }] : []),
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$binId',
          binId: { $first: '$binId' },
          block: { $first: '$block' },
          level: { $first: '$level' },
          lastUpdated: { $first: '$createdAt' },
        },
      },
      { $sort: { block: 1, binId: 1 } },
      { $limit: limit },
    ]);

    console.log(`[IOT] GET /data -> returning ${latestBins.length} bin(s)`);
    res.json(latestBins);
  } catch (err) {
    console.error('[IOT GET ERROR]:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Bin reading history for charts, diagnostics and ML data prep
// @route   GET /api/iot/readings?binId=&since=&limit=
// @access  Protected (any authenticated role)
const getReadings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.binId) filter.binId = String(req.query.binId).trim().toUpperCase();
    if (req.query.block) filter.block = String(req.query.block).toUpperCase();
    if (req.query.since) {
      const since = new Date(req.query.since);
      if (!Number.isNaN(since.getTime())) filter.readAt = { $gte: since };
    }
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));

    const readings = await BinReading.find(filter)
      .select('binId block level temperature signal source readAt createdAt')
      .sort({ readAt: -1 })
      .limit(limit)
      .lean();
    res.json(readings);
  } catch (err) {
    console.error('[IOT READINGS ERROR]:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { processIotData, getIotData, getReadings };