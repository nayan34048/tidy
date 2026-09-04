import type { Dataset } from '../types/dataset';

/**
 * Intentionally messy: missing values, duplicate rows, inconsistent
 * capitalization, dirty numbers, and a couple of invalid values — enough
 * for every panel in Tidy to have something to do.
 */
export const sampleStudents: Dataset = {
  meta: { name: 'students_sample', sourceFileName: 'students_sample.csv', importedAt: Date.now() },
  columns: [
    { name: 'SL', type: 'integer', inferred: true },
    { name: 'Name', type: 'string', inferred: true },
    { name: 'Department', type: 'category', inferred: true },
    { name: 'Gender', type: 'category', inferred: true },
    { name: 'Age', type: 'string', inferred: true },
    { name: 'GPA', type: 'string', inferred: true },
    { name: 'Enrolled', type: 'string', inferred: true },
    { name: 'Email', type: 'string', inferred: true },
  ],
  rows: [
    { SL: 101, Name: 'Rahim Uddin', Department: 'CSE', Gender: 'Male', Age: '22', GPA: '3.75', Enrolled: '2022-01-15', Email: 'rahim@example.edu' },
    { SL: 102, Name: 'Karim Ahmed', Department: 'EEE', Gender: 'male', Age: '23', GPA: '3.50', Enrolled: '2022-01-15', Email: 'karim@example.edu' },
    { SL: 103, Name: '  Hasan Ali', Department: 'BBA', Gender: 'M', Age: '21', GPA: '3.90', Enrolled: '2022-08-01', Email: 'not-an-email' },
    { SL: 104, Name: 'Fatima Noor', Department: 'CSE', Gender: 'Female', Age: '250', GPA: '3.20', Enrolled: '2023-01-10', Email: 'fatima@example.edu' },
    { SL: 105, Name: 'Ayesha Khan', Department: 'EEE', Gender: 'FEMALE', Age: '20', GPA: 'N/A', Enrolled: '2023-01-10', Email: 'ayesha@example.edu' },
    { SL: 106, Name: 'Nusrat Jahan', Department: 'cse', Gender: 'female', Age: 'unknown', GPA: '3.10', Enrolled: '2021-09-01', Email: 'nusrat@example.edu' },
    { SL: 107, Name: 'Tanvir Islam', Department: 'BBA', Gender: 'Male', Age: '24', GPA: '2.95', Enrolled: '2020-01-20', Email: 'tanvir@example.edu' },
    { SL: 107, Name: 'Tanvir Islam', Department: 'BBA', Gender: 'Male', Age: '24', GPA: '2.95', Enrolled: '2020-01-20', Email: 'tanvir@example.edu' },
    { SL: 108, Name: 'Mim Akter', Department: 'EEE', Gender: 'Female', Age: '19', GPA: '3.65', Enrolled: '2024-01-05', Email: 'mim@example.edu' },
    { SL: 109, Name: null, Department: 'CSE', Gender: 'Male', Age: '25', GPA: '3.30', Enrolled: '2019-01-12', Email: 'unknown@example.edu' },
    { SL: 110, Name: 'Sadia Rahman', Department: null, Gender: 'Female', Age: '22', GPA: '3.85', Enrolled: '2022-01-15', Email: 'sadia@example.edu' },
    { SL: 111, Name: 'Jahid Hasan', Department: 'BBA', Gender: 'Male', Age: '-5', GPA: '2.80', Enrolled: '2099-01-01', Email: 'jahid@example.edu' },
    { SL: null, Name: null, Department: null, Gender: null, Age: null, GPA: null, Enrolled: null, Email: null },
  ],
};

export const sampleResults: Dataset = {
  meta: { name: 'exam_results_sample', sourceFileName: 'exam_results_sample.csv', importedAt: Date.now() },
  columns: [
    { name: 'SL', type: 'integer', inferred: true },
    { name: 'Semester', type: 'category', inferred: true },
    { name: 'Credits Completed', type: 'string', inferred: true },
    { name: 'CGPA', type: 'string', inferred: true },
  ],
  rows: [
    { SL: 101, 'Semester': 'Fall 2023', 'Credits Completed': '15', CGPA: '3.72' },
    { SL: 102, 'Semester': 'Fall 2023', 'Credits Completed': '12', CGPA: '3.44' },
    { SL: 103, 'Semester': 'Fall 2023', 'Credits Completed': '$15', CGPA: '3.88' },
    { SL: 105, 'Semester': 'Fall 2023', 'Credits Completed': '9', CGPA: '3.15' },
    { SL: 106, 'Semester': 'Fall 2023', 'Credits Completed': '15', CGPA: '3.05' },
    { SL: 108, 'Semester': 'Fall 2023', 'Credits Completed': '18', CGPA: '3.60' },
    { SL: 120, 'Semester': 'Fall 2023', 'Credits Completed': '15', CGPA: '3.40' },
  ],
};
