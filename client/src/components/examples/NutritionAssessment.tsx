import NutritionAssessment from '../NutritionAssessment'

export default function NutritionAssessmentExample() {
  return <NutritionAssessment onComplete={(data) => console.log('Nutrition data:', data)} />
}
