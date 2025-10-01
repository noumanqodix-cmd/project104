import AvailabilityForm from '../AvailabilityForm'

export default function AvailabilityFormExample() {
  return <AvailabilityForm onComplete={(data) => console.log('Availability:', data)} />
}
