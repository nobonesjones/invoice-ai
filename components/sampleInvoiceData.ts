export const sampleInvoices = [
  {
    id: '1',
    clientName: 'Acme Corporation',
    amount: '$2,450.00',
    dueDate: '2024-02-15',
    status: 'paid' as const,
    items: [
      { name: 'Web Development', quantity: 1, price: '$2,000.00' },
      { name: 'Domain Setup', quantity: 1, price: '$450.00' },
    ],
    backgroundColor: '#f0f9ff',
    accentColor: '#0ea5e9',
    imageSource: require('../assets/onboarding/final/invoice_1.png'),
    template: 'clean'
  },
  {
    id: '2',
    clientName: 'Tech Solutions Ltd',
    amount: '$1,850.00',
    dueDate: '2024-02-20',
    status: 'pending' as const,
    items: [
      { name: 'Mobile App Design', quantity: 1, price: '$1,500.00' },
      { name: 'User Testing', quantity: 1, price: '$350.00' },
    ],
    backgroundColor: '#fef3c7',
    accentColor: '#f59e0b',
    imageSource: require('../assets/onboarding/final/Invoice_2.png'),
    template: 'modern'
  },
  {
    id: '3',
    clientName: 'Creative Agency',
    amount: '$3,200.00',
    dueDate: '2024-02-25',
    status: 'overdue' as const,
    items: [
      { name: 'Brand Identity', quantity: 1, price: '$2,500.00' },
      { name: 'Logo Design', quantity: 1, price: '$700.00' },
    ],
    backgroundColor: '#fef2f2',
    accentColor: '#ef4444',
    imageSource: require('../assets/onboarding/final/invoice_3.png'),
    template: 'simple'
  },
  {
    id: '4',
    clientName: 'Startup Inc',
    amount: '$1,650.00',
    dueDate: '2024-03-01',
    status: 'paid' as const,
    items: [
      { name: 'Website Redesign', quantity: 1, price: '$1,200.00' },
      { name: 'SEO Optimization', quantity: 1, price: '$450.00' },
    ],
    backgroundColor: '#f0fdf4',
    accentColor: '#22c55e',
    imageSource: require('../assets/onboarding/final/Invoice_4.png'),
    template: 'classic'
  },
  {
    id: '5',
    clientName: 'Enterprise Corp',
    amount: '$4,750.00',
    dueDate: '2024-03-05',
    status: 'pending' as const,
    items: [
      { name: 'System Integration', quantity: 1, price: '$3,500.00' },
      { name: 'Training Sessions', quantity: 1, price: '$1,250.00' },
    ],
    backgroundColor: '#faf5ff',
    accentColor: '#8B5CF6',
    imageSource: require('../assets/onboarding/final/Invoice_5.png'),
    template: 'wave'
  },
  {
    id: '6',
    clientName: 'Global Enterprises',
    amount: '$6,600.00',
    dueDate: '2024-03-10',
    status: 'paid' as const,
    items: [
      { name: 'Event Catering', quantity: 1, price: '$1,000.00' },
      { name: 'Full Event Bar', quantity: 1, price: '$2,500.00' },
      { name: 'Staff', quantity: 2, price: '$1,000.00' },
    ],
    backgroundColor: '#eff6ff',
    accentColor: '#3b82f6',
    imageSource: require('../assets/onboarding/final/Invoice_6.png'),
    template: 'wave'
  },
  {
    id: '7',
    clientName: 'Design Studio',
    amount: '$3,890.00',
    dueDate: '2024-03-15',
    status: 'pending' as const,
    items: [
      { name: 'UI/UX Design', quantity: 1, price: '$2,500.00' },
      { name: 'Prototyping', quantity: 1, price: '$890.00' },
      { name: 'User Research', quantity: 1, price: '$500.00' },
    ],
    backgroundColor: '#f0fdf4',
    accentColor: '#059669',
    imageSource: require('../assets/onboarding/final/Invoice_7.png'),
    template: 'clean'
  },
]; 