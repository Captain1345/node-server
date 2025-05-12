const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json({ limit: '1000mb' }));

// PDF Service URL
const PDF_SERVICE_URL = 'http://localhost:8002';

// Enhanced error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Multi-file PDF processing endpoint
app.post('/api/convert-pdfs-chunks', upload.array('files', 10), async (req, res) => { // Limit to 10 files
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Prepare FormData for Python service
        const formData = new FormData();
        req.files.forEach(file => {
            formData.append('files', file.buffer, {
                filename: file.originalname,
                contentType: file.mimetype
            });
        });

        // Call Python microservice
        const response = await axios.post(
            `${PDF_SERVICE_URL}/convert-pdfs-chunks`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
                maxContentLength: 100 * 1024 * 1024, // 100MB max
                maxBodyLength: 100 * 1024 * 1024
            }
        );

        // Group chunks by file for better frontend display
        const groupedResults = response.data.reduce((acc, chunk) => {
            if (!acc[chunk.file_name]) {
                acc[chunk.file_name] = [];
            }
            acc[chunk.file_name].push(chunk);
            return acc;
        }, {});

        res.json({
            success: true,
            total_chunks: response.data.length,
            files_processed: req.files.length,
            results: groupedResults,
            raw_chunks: response.data // Also provide flat list
        });

    } catch (error) {
        console.error('PDF processing error:', error.response?.data || error.message);
        
        let status = 500;
        let message = 'Failed to process PDFs';
        
        if (error.response) {
            status = error.response.status;
            message = error.response.data?.detail || message;
        }
        
        res.status(status).json({ 
            error: message,
            details: error.response?.data || error.message
        });
    }
});


// Add this route to your existing server
app.post('/api/vector-collection/add', async (req, res) => {
    try {
      const { chunks, fileName } = req.body;
      console.log(chunks, fileName)
      if (!chunks || !fileName) {
        return res.status(400).json({ error: 'Both chunks and fileName are required' });
      }
  
      const response = await axios.post(`${PDF_SERVICE_URL}/add-to-vector-collection`, {
        chunks: chunks,
        file_name: fileName
      });
  
      res.json(response.data);
    } catch (error) {
      console.error('Error adding to vector collection:', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Failed to add to vector collection',
        details: error.response?.data || error.message
      });
    }
  });

// Start server
const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});