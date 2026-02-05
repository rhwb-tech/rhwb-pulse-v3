import React from 'react';
import { Box } from '@mui/material';
import VeerChatbot from './VeerChatbot';

const VeerFullPage: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', p: 2 }}>
      <VeerChatbot fullPage />
    </Box>
  );
};

export default VeerFullPage;
