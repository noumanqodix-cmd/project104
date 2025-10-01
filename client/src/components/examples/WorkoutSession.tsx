import WorkoutSession from '../WorkoutSession'

export default function WorkoutSessionExample() {
  return <WorkoutSession onComplete={(summary) => console.log('Workout complete:', summary)} />
}
