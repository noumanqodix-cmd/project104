import WorkoutProgramView from '../WorkoutProgramView'

export default function WorkoutProgramViewExample() {
  return (
    <WorkoutProgramView 
      onBack={() => console.log('Back')}
      onSave={(exercises) => console.log('Save exercises:', exercises)}
    />
  )
}
