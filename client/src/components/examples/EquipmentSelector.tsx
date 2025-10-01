import EquipmentSelector from '../EquipmentSelector'

export default function EquipmentSelectorExample() {
  return <EquipmentSelector onComplete={(equipment) => console.log('Selected equipment:', equipment)} />
}
