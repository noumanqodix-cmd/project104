import Dashboard from '../Dashboard'

export default function DashboardExample() {
  return (
    <Dashboard 
      onStartWorkout={() => console.log('Start workout')}
      onViewProgram={() => console.log('View program')}
      onViewHistory={() => console.log('View history')}
      onViewProgress={() => console.log('View progress')}
    />
  )
}
