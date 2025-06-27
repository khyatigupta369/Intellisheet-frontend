import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import './App.css'
import config from './config.js';

// --- ICONS ---
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
);
const TransformIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" x2="12" y1="9" y2="13"></line><line x1="12" x2="12.01" y1="17" y2="17"></line></svg>
);
const SuccessIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
);

// --- HELPER FUNCTIONS ---
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// --- PREVIEW TABLE COMPONENT ---
const PreviewTable = ({ previewData, newColumns = [] }) => {
  if (!previewData) return null;
  const headers = previewData.data[0] || [];
  const rows = previewData.data.slice(1, 16);

  return (
    <div className="table-container">
      <table className="excel-table">
        <thead style={{ position: 'sticky', top: 0 }}>
          <tr>
            {headers.slice(0, 12).map((h, i) => (
              <th key={i} className={newColumns.includes(h) ? 'new-column' : ''}>{h}</th>
            ))}
            {headers.length > 12 && <th>...</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.slice(0, 12).map((cell, cellIndex) => (
                <td key={cellIndex} className={newColumns.includes(headers[cellIndex]) ? 'new-column' : ''}>{cell}</td>
              ))}
              {row.length > 12 && <td className="placeholder">...</td>}
            </tr>
          ))}
          {previewData.data.length > 16 && (
            <tr><td colSpan={Math.min(headers.length, 13)} className="placeholder">... +{previewData.data.length - 16} more rows</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// --- TRANSFORMATION RESULT SCREEN ---
function TransformationResultScreen({ transformResult, resetAll }) {
  const [activeTab, setActiveTab] = useState('preview');
  const [outputPreview, setOutputPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copyButtonText, setCopyButtonText] = useState('Copy Code');

  useEffect(() => {
    const loadOutputPreview = async () => {
      if (!transformResult?.output_url) return;
      setIsLoading(true);
      try {
        const response = await fetch(transformResult.output_url);
        if (!response.ok) throw new Error('Failed to download transformed file for preview.');
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = "Transformed Data";
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) throw new Error(`Sheet "${sheetName}" not found in the output file.`);

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        setOutputPreview({
          data: jsonData,
          totalRows: range.e.r + 1,
          totalCols: range.e.c + 1,
        });
      } catch (err) {
        console.error("Preview Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadOutputPreview();
  }, [transformResult]);

  useEffect(() => {
    if (activeTab === 'code' && window.Prism) {
      window.Prism.highlightAll();
    }
  }, [activeTab]);

  const handleCopyCode = () => {
    if (transformResult.transformation_code) {
      navigator.clipboard.writeText(transformResult.transformation_code).then(() => {
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy Code'), 2000);
      });
    }
  };

  const { changes } = transformResult;

  return (
    <main className="results-view-container">
      <section className="results-header">
        <div className="results-header-status">
          <div className="status-icon"><SuccessIcon /></div>
          <div className="status-details">
            <h3>Transformation Successful</h3>
            <div className="status-metadata">
              <span>{transformResult.output_url.split('/').pop()}</span>
              <span className="separator">|</span>
              <span>Size: <span>{formatFileSize(transformResult.size)}</span></span>
              <span className="separator">|</span>
              <span>Dimensions: <span>{changes.rows.transformed} Rows x {changes.columns.transformed} Cols</span></span>
            </div>
          </div>
        </div>
        <div className="results-header-actions">
          <a href={transformResult.output_url} download className="action-button download-button"><DownloadIcon />Download</a>
          <button type="button" onClick={resetAll} className="action-button new-file-button"><TransformIcon />New File</button>
        </div>
      </section>

      <section className="results-tabs-container">
        <nav className="tab-nav">
          <button onClick={() => setActiveTab('preview')} className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}>Transformed Preview</button>
          <button onClick={() => setActiveTab('code')} className={`tab-button ${activeTab === 'code' ? 'active' : ''}`}>Generated Code</button>
        </nav>
        <div className="tab-content">
          <div className={`tab-pane ${activeTab === 'preview' ? '' : 'hidden'}`}>
            {isLoading ? <div style={{display: 'flex', justifyContent: 'center', padding: '2rem'}}><div className="loader"></div></div> : <PreviewTable previewData={outputPreview} newColumns={changes.columns.added} />}
          </div>
          <div className={`tab-pane code-pane ${activeTab === 'code' ? '' : 'hidden'}`}>
            <button onClick={handleCopyCode} className="copy-code-button">{copyButtonText}</button>
            <pre className="line-numbers language-python">
              <code id="code-block">{transformResult.transformation_code}</code>
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}

// --- MAIN APP COMPONENT ---
function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [tabName, setTabName] = useState('');
  const [transformPrompt, setTransformPrompt] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformResult, setTransformResult] = useState(null);
  const [inputFilePreview, setInputFilePreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const resetAll = useCallback(() => {
    setSelectedFile(null);
    setTransformResult(null);
    setInputFilePreview(null);
    setTabName('');
    setTransformPrompt('');
    setError(null);
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
  }, []);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    resetAll();
    const validExtensions = ['.xlsx', '.xls', '.xlsm'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExtension)) {
      setError('Please select an Excel file (.xlsx, .xls, .xlsm)');
      return;
    }
    setSelectedFile(file);
    setIsLoadingPreview(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) throw new Error('No sheets found in file.');
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      setInputFilePreview({
        fileName: file.name, fileSize: file.size, sheetName: firstSheetName,
        data: jsonData, totalRows: range.e.r + 1, totalCols: range.e.c + 1,
      });
    } catch (err) {
      setError(`Failed to preview file: ${err.message}`);
      setInputFilePreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [resetAll]);

  const handleFileChangeEvent = (event) => handleFileSelect(event.target.files[0]);
  const handleDragOver = useCallback((event) => { event.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((event) => { event.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files?.[0]) handleFileSelect(event.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const handleTransformSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) { setError("A file must be selected to transform."); return; }
    if (!transformPrompt.trim()) { setError("Please provide a transformation prompt."); return; }
    setError(null);
    setTransformResult(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const uploadResponse = await fetch(`${config.apiBaseUrl}/upload-file`, { method: 'POST', body: formData });
      if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      const newUploadResult = await uploadResponse.json();
      setIsUploading(false);
      setIsTransforming(true);
      const payload = {
        url: newUploadResult.file_url,
        prompt: transformPrompt.trim(),
        ...(tabName.trim() && { tab_name: tabName.trim() }),
      };
      const transformResponse = await fetch(`${config.apiBaseUrl}/transform-excel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!transformResponse.ok) throw new Error(`Transformation failed: ${transformResponse.statusText}`);
      const newTransformResult = await transformResponse.json();
      setTransformResult({ ...newTransformResult, size: newUploadResult.size });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      setIsTransforming(false);
    }
  };

  const isProcessing = isUploading || isTransforming;

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+Enter (Mac) or Ctrl+Enter (Win/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        // Only trigger if the form is visible (not on result screen)
        if (!transformResult && inputFilePreview) {
          const form = document.querySelector('.transform-form');
          if (form) {
            form.requestSubmit();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transformResult, inputFilePreview]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Intelli<span>sheet</span></h1>
        <p>AI-powered Excel transformations, made simple.</p>
      </header>

      <input id="file-input" type="file" onChange={handleFileChangeEvent} accept=".xlsx,.xls,.xlsm" style={{ display: 'none' }} />

      {transformResult ? (
        <TransformationResultScreen transformResult={transformResult} resetAll={resetAll} />
      ) : !inputFilePreview && !isLoadingPreview ? (
        <div className={`upload-view ${isDragOver ? 'drag-over' : ''}`} onClick={() => document.getElementById('file-input').click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div className="upload-view-content">
            <UploadIcon />
            <h3>Upload your Excel file</h3>
            <p>Drag and drop or click to browse</p>
            <button type="button" className="browse-button">Browse Files</button>
          </div>
        </div>
      ) : (
        <main className="main-grid">
          <div className="preview-column">
            <div className="preview-view">
              <div className="preview-header"><h3>File Preview: <span>{inputFilePreview?.fileName}</span></h3></div>
              {isLoadingPreview ? <div style={{display: 'flex', justifyContent: 'center', padding: '2rem'}}><div className="loader"></div></div> : <PreviewTable previewData={inputFilePreview} />}
            </div>
          </div>
          <div className="controls-column">
            <div className="control-group">
              <h3>File Details</h3>
              <div className="details-grid">
                <div className="detail-item"><span>File Name:</span><span>{inputFilePreview?.fileName}</span></div>
                <div className="detail-item"><span>File Size:</span><span>{formatFileSize(inputFilePreview?.fileSize)}</span></div>
                <div className="detail-item"><span>Dimensions:</span><span>{inputFilePreview?.totalRows} Rows x {inputFilePreview?.totalCols} Cols</span></div>
              </div>
            </div>
            <div className="separator"></div>
            <form className="transform-form" onSubmit={handleTransformSubmit}>
              <div className="input-group">
                <label htmlFor="tab-name">Sheet / Tab Name (Optional)</label>
                <input type="text" id="tab-name" value={tabName} onChange={e => setTabName(e.target.value)} className="text-input" placeholder="Defaults to first sheet"/>
              </div>
              <div className="input-group">
                <label htmlFor="prompt">Transformation Prompt</label>
                <textarea id="prompt" value={transformPrompt} onChange={e => setTransformPrompt(e.target.value)} className="text-area" placeholder="e.g., 'Filter for rows where profit is greater than $500.'"></textarea>
              </div>
              <button type="submit" className="transform-button" disabled={isProcessing || !selectedFile}>
                {isProcessing ? <div className="loader"></div> : <TransformIcon />}
                Transform File <span style={{fontSize: '0.85em', color: '#9ca3af', marginLeft: 8}}>(⌘+Enter)</span>
              </button>
            </form>
            {error && <div className="error-message">{error}</div>}
            <button onClick={resetAll} style={{background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', marginTop: 'auto', alignSelf: 'center'}}>Start Over</button>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
