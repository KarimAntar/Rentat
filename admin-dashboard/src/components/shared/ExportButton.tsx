import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Download } from '@mui/icons-material';

interface ExportButtonProps {
  data: any[];
  filename: string;
  headers?: string[];
  loading?: boolean;
  disabled?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  filename,
  headers,
  loading = false,
  disabled = false,
}) => {
  const exportToCSV = () => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    // Get headers from first object if not provided
    const csvHeaders = headers || Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...data.map(row => 
        csvHeaders.map(header => {
          const value = row[header];
          // Handle values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      variant="outlined"
      startIcon={loading ? <CircularProgress size={20} /> : <Download />}
      onClick={exportToCSV}
      disabled={disabled || loading || !data || data.length === 0}
    >
      Export CSV
    </Button>
  );
};
