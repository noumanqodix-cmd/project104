import WorkoutHistory from '../WorkoutHistory'

export default function WorkoutHistoryExample() {
  return <WorkoutHistory onBack={() => console.log('Back')} />
}
