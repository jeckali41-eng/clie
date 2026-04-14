export const addressSuggestions = [
  {
    id: '1',
    address: '78 Eastwood Street',
    description: 'West Turffontein, Johannesburg',
    distance: '<1 km'
  },
  {
    id: '2',
    address: 'KFC Gandhi Square',
    description: 'Umnutho House, Eloff Street, Marshalltown',
    distance: '2.5 km'
  },
  {
    id: '3',
    address: '130 Main Street',
    description: 'Marshalltown, Johannesburg',
    distance: '1.8 km'
  },
  {
    id: '4',
    address: '8 Turf Street',
    description: 'Forest Hill, Johannesburg',
    distance: '3.2 km'
  },
  {
    id: '5',
    address: 'Johannesburg Park Station',
    description: 'Rissik Street, Johannesburg',
    distance: '2.1 km'
  },
  {
    id: '6',
    address: 'Mall of Africa',
    description: 'Magwa Crescent, Waterval City, Johannesburg',
    distance: '15.3 km'
  },
  {
    id: '7',
    address: 'Johannesburg OR Tambo Airport (JNB)',
    description: '1 Jones Road, OR Tambo International Airport',
    distance: '45.2 km'
  },
  {
    id: '8',
    address: '49 Cornwell Street',
    description: 'West Turffontein, Johannesburg',
    distance: '<1 km'
  },
  {
    id: '9',
    address: '47 Cornwell Street',
    description: 'West Turffontein, Johannesburg',
    distance: '<1 km'
  },
  {
    id: '10',
    address: '46 Cornwell Street',
    description: 'West Turffontein, Johannesburg',
    distance: '<1 km'
  }
];

export const getAddressSuggestions = (query: string) => {
  if (!query.trim()) return addressSuggestions;
  
  return addressSuggestions.filter(
    suggestion =>
      suggestion.address.toLowerCase().includes(query.toLowerCase()) ||
      suggestion.description.toLowerCase().includes(query.toLowerCase())
  );
};