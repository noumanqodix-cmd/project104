import WorkoutSummary from '../WorkoutSummary'

export default function WorkoutSummaryExample() {
  return (
    <WorkoutSummary 
      duration={2400}
      exercises={6}
      totalVolume={5420}
      onFinish={(difficulty) => console.log('Workout difficulty:', difficulty)}
    />
  )
}
