import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DepositTable } from '../components/deposits/DepositTable';
import { DepositActionModal } from '../components/deposits/DepositActionModal';

interface Deposit {
  id: string;
  rentalId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'held' | 'released' | 'partial_refund';
  holdReason?: string;
  releaseReason?: string;
  partialAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const DepositManagementPage: React.FC = () => {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [filteredDeposits, setFilteredDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [modalAction, setModalAction] = useState<'release' | 'partial' | 'hold' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchDeposits = async () => {
    setLoading(true);
    setError(null);

    try {
      const depositsRef = collection(db, 'deposits');
      const q = query(depositsRef, orderBy('createdAt', 'desc'));
      
      const snapshot = await getDocs(q);
      const fetchedDeposits: Deposit[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Deposit[];

      setDeposits(fetchedDeposits);
      filterDeposits(fetchedDeposits, tabValue);
    } catch (err: any) {
      console.error('Error fetching deposits:', err);
      setError(err.message || 'Failed to fetch deposits');
    } finally {
      setLoading(false);
    }
  };

  const filterDeposits = (allDeposits: Deposit[], tab: number) => {
    let filtered: Deposit[];
    
    switch (tab) {
      case 0: // All
        filtered = allDeposits;
        break;
      case 1: // Held
        filtered = allDeposits.filter(d => d.status === 'held');
        break;
      case 2: // Released
        filtered = allDeposits.filter(d => d.status === 'released');
        break;
      case 3: // Partial Refund
        filtered = allDeposits.filter(d => d.status === 'partial_refund');
        break;
      default:
        filtered = allDeposits;
    }
    
    setFilteredDeposits(filtered);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    filterDeposits(deposits, newValue);
  };

  const handleActionClick = (deposit: Deposit, action: 'release' | 'partial' | 'hold') => {
    setSelectedDeposit(deposit);
    setModalAction(action);
    setModalOpen(true);
  };

  const handleModalSubmit = async (
    depositId: string,
    action: string,
    reason: string,
    amount?: number
  ) => {
    // Import the deposit service functions
    const { releaseDeposit, releasePartialDeposit, holdDeposit } = await import(
      '../../../src/services/depositService'
    );

    try {
      switch (action) {
        case 'release':
          await releaseDeposit(depositId, reason);
          break;
        case 'partial':
          if (!amount) throw new Error('Amount is required for partial release');
          await releasePartialDeposit(depositId, amount, reason);
          break;
        case 'hold':
          await holdDeposit(depositId, reason);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Refresh deposits after successful action
      await fetchDeposits();
      setModalOpen(false);
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, []);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Deposit Management
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchDeposits}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label={`All (${deposits.length})`} />
          <Tab label={`Held (${deposits.filter(d => d.status === 'held').length})`} />
          <Tab label={`Released (${deposits.filter(d => d.status === 'released').length})`} />
          <Tab label={`Partial Refund (${deposits.filter(d => d.status === 'partial_refund').length})`} />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DepositTable
            deposits={filteredDeposits}
            onActionClick={handleActionClick}
          />
        )}
      </Paper>

      <DepositActionModal
        open={modalOpen}
        deposit={selectedDeposit}
        action={modalAction}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </Container>
  );
};
