// Utility to calculate profile completion percentage
// Profile is considered complete at 80%

export interface ProfileCompletion {
  percentage: number;
  isComplete: boolean;
  missingFields: string[];
}

export function calculateProfileCompletion(user: any): ProfileCompletion {
  if (!user) {
    return { percentage: 0, isComplete: false, missingFields: [] };
  }

  const fields = [
    { key: 'full_name', label: 'Full Name', weight: 15 },
    { key: 'age', label: 'Age', weight: 10 },
    { key: 'bio', label: 'Bio', weight: 10 },
    { key: 'location', label: 'Location', weight: 10 },
    { key: 'avatar_url', label: 'Profile Picture', weight: 10 },
    { key: 'cover_image_url', label: 'Cover Image', weight: 5 },
    { key: 'sports', label: 'Sports Interests', weight: 15, check: (val: any) => val && val.length > 0 },
    { key: 'goals', label: 'Goals', weight: 10, check: (val: any) => val && val.length > 0 },
    { key: 'photos', label: 'Photos', weight: 15, check: (val: any) => val && val.length >= 2 },
  ];

  let totalScore = 0;
  const missingFields: string[] = [];

  fields.forEach(field => {
    const value = user[field.key];
    let isComplete = false;

    if (field.check) {
      isComplete = field.check(value);
    } else {
      isComplete = value !== null && value !== undefined && value !== '';
    }

    if (isComplete) {
      totalScore += field.weight;
    } else {
      missingFields.push(field.label);
    }
  });

  const percentage = Math.min(100, totalScore);
  const isComplete = percentage >= 80;

  return { percentage, isComplete, missingFields };
}
