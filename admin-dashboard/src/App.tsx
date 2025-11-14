import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Container, Typography, Paper } from '@mui/material';
import theme from './theme';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Container maxWidth="md">
          <Paper
            elevation={3}
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: 4,
            }}
          >
            <Typography variant="h2" gutterBottom color="primary">
              🏠 Rentat Admin Dashboard
            </Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 4 }}>
              Rental Marketplace Management Platform
            </Typography>
            
            <Box sx={{ mt: 4, textAlign: 'left' }}>
              <Typography variant="h6" gutterBottom>
                ✅ Foundation Complete!
              </Typography>
              <Typography variant="body1" paragraph>
                The admin dashboard foundation has been successfully set up with:
              </Typography>
              <ul style={{ lineHeight: 2 }}>
                <li>React 18 + TypeScript + Vite</li>
                <li>Material-UI (MUI) v5+</li>
                <li>Firebase configuration</li>
                <li>Comprehensive type definitions</li>
                <li>Theme configuration (light/dark mode)</li>
                <li>Project structure for all features</li>
              </ul>
              
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                📋 Next Steps:
              </Typography>
              <Typography variant="body2" paragraph>
                Check the README.md for the complete implementation roadmap. The foundation includes:
              </Typography>
              <ul style={{ lineHeight: 1.8, fontSize: '0.9rem' }}>
                <li>Authentication system setup</li>
                <li>Dashboard layout components</li>
                <li>User management features</li>
                <li>Content moderation tools</li>
                <li>Analytics dashboard</li>
                <li>Notification system</li>
                <li>Feature flags management</li>
              </ul>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
              Created for Rentat - Your trusted rental marketplace
            </Typography>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
