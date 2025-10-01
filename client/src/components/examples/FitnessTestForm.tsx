import FitnessTestForm from '../FitnessTestForm'

export default function FitnessTestFormExample() {
  return <FitnessTestForm onComplete={(results) => console.log('Test results:', results)} />
}
