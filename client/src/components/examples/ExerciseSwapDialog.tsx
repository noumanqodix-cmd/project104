import ExerciseSwapDialog from '../ExerciseSwapDialog'

export default function ExerciseSwapDialogExample() {
  const mockExercise = {
    id: "1",
    name: "Barbell Bench Press",
    equipment: "barbell",
    sets: 4,
    reps: "8-10",
    weight: "135 lbs",
    tempo: "1-2-1-1",
    formVideoUrl: "#",
  }
  
  return (
    <ExerciseSwapDialog 
      exercise={mockExercise}
      onSwap={(newEx) => console.log('Swapped to:', newEx)}
      onClose={() => console.log('Dialog closed')}
    />
  )
}
