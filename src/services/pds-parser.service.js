const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

class PDSParser {
  constructor() {
    this.sections = {
      personalInfo: {
        start: 'I. PERSONAL INFORMATION',
        end: 'II. FAMILY BACKGROUND'
      },
      familyBackground: {
        start: 'II. FAMILY BACKGROUND',
        end: 'III. EDUCATIONAL BACKGROUND'
      },
      education: {
        start: 'III. EDUCATIONAL BACKGROUND',
        end: 'IV. CIVIL SERVICE ELIGIBILITY'
      },
      civilService: {
        start: 'IV. CIVIL SERVICE ELIGIBILITY',
        end: 'V. WORK EXPERIENCE'
      },
      workExperience: {
        start: 'V. WORK EXPERIENCE',
        end: 'VI. VOLUNTARY WORK OR INVOLVEMENT IN CIVIC / NON-GOVERNMENT / PEOPLE / VOLUNTARY ORGANIZATION/S'
      },
      voluntaryWork: {
        start:
          'VI. VOLUNTARY WORK OR INVOLVEMENT IN CIVIC / NON-GOVERNMENT / PEOPLE / VOLUNTARY ORGANIZATION/S',
        end: 'VII. LEARNING AND DEVELOPMENT (L&D) INTERVENTIONS/TRAINING PROGRAMS ATTENDED'
      },
      training: {
        start:
          'VII. LEARNING AND DEVELOPMENT (L&D) INTERVENTIONS/TRAINING PROGRAMS ATTENDED',
        end: 'VIII. OTHER INFORMATION'
      },
      otherInfo: {
        start: 'VIII. OTHER INFORMATION',
        end: 'IX. REFERENCES'
      },
      references: {
        start: 'IX. REFERENCES',
        end: 'X. CERTIFICATION'
      }
    };
  }

  async parsePDS(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      const text = data.text;

      return {
        personalInfo: this.parsePersonalInfo(text),
        familyBackground: this.parseFamilyBackground(text),
        education: this.parseEducation(text),
        civilService: this.parseCivilService(text),
        workExperience: this.parseWorkExperience(text),
        voluntaryWork: this.parseVoluntaryWork(text),
        training: this.parseTraining(text),
        otherInfo: this.parseOtherInfo(text),
        references: this.parseReferences(text)
      };
    } catch (error) {
      throw new Error(`Error parsing PDS: ${error.message}`);
    }
  }

  getSectionText(text, section) {
    const startIndex = text.indexOf(section.start);
    const endIndex = text.indexOf(section.end);

    if (startIndex === -1 || endIndex === -1) {
      return '';
    }

    return text.substring(startIndex, endIndex).trim();
  }

  parsePersonalInfo(text) {
    const sectionText = this.getSectionText(text, this.sections.personalInfo);
    const lines = sectionText.split('\n');

    const personalInfo = {
      firstName: '',
      lastName: '',
      middleName: '',
      birthDate: '',
      birthPlace: '',
      gender: '',
      civilStatus: '',
      citizenship: '',
      address: {
        residential: {},
        permanent: {}
      },
      contactInfo: {
        telephone: '',
        mobile: '',
        email: ''
      }
    };

    // Parse each line and extract information
    lines.forEach(line => {
      if (line.includes('First Name:')) {
        personalInfo.firstName = line.split(':')[1].trim();
      } else if (line.includes('Last Name:')) {
        personalInfo.lastName = line.split(':')[1].trim();
      } else if (line.includes('Middle Name:')) {
        personalInfo.middleName = line.split(':')[1].trim();
      } else if (line.includes('Date of Birth:')) {
        personalInfo.birthDate = line.split(':')[1].trim();
      } else if (line.includes('Place of Birth:')) {
        personalInfo.birthPlace = line.split(':')[1].trim();
      } else if (line.includes('Sex:')) {
        personalInfo.gender = line.split(':')[1].trim();
      } else if (line.includes('Civil Status:')) {
        personalInfo.civilStatus = line.split(':')[1].trim();
      } else if (line.includes('Citizenship:')) {
        personalInfo.citizenship = line.split(':')[1].trim();
      }
      // Add more parsing logic for other fields
    });

    return personalInfo;
  }

  parseFamilyBackground(text) {
    const sectionText = this.getSectionText(
      text,
      this.sections.familyBackground
    );
    const lines = sectionText.split('\n');

    const familyBackground = {
      spouse: {
        name: '',
        occupation: '',
        employer: '',
        businessAddress: '',
        telephone: ''
      },
      father: {
        name: '',
        occupation: '',
        employer: '',
        businessAddress: '',
        telephone: ''
      },
      mother: {
        name: '',
        occupation: '',
        employer: '',
        businessAddress: '',
        telephone: ''
      }
    };

    // Parse each line and extract information
    lines.forEach(line => {
      if (line.includes("Spouse's Name:")) {
        familyBackground.spouse.name = line.split(':')[1].trim();
      } else if (line.includes("Father's Name:")) {
        familyBackground.father.name = line.split(':')[1].trim();
      } else if (line.includes("Mother's Name:")) {
        familyBackground.mother.name = line.split(':')[1].trim();
      }
      // Add more parsing logic for other fields
    });

    return familyBackground;
  }

  parseEducation(text) {
    const sectionText = this.getSectionText(text, this.sections.education);
    const lines = sectionText.split('\n');

    const education = [];
    let currentEducation = null;

    lines.forEach(line => {
      if (line.includes('Level:')) {
        if (currentEducation) {
          education.push(currentEducation);
        }
        currentEducation = {
          level: line.split(':')[1].trim(),
          schoolName: '',
          degree: '',
          from: '',
          to: '',
          units: '',
          yearGraduated: '',
          honors: ''
        };
      } else if (currentEducation) {
        if (line.includes('School:')) {
          currentEducation.schoolName = line.split(':')[1].trim();
        } else if (line.includes('Degree:')) {
          currentEducation.degree = line.split(':')[1].trim();
        } else if (line.includes('From:')) {
          currentEducation.from = line.split(':')[1].trim();
        } else if (line.includes('To:')) {
          currentEducation.to = line.split(':')[1].trim();
        } else if (line.includes('Year Graduated:')) {
          currentEducation.yearGraduated = line.split(':')[1].trim();
        } else if (line.includes('Honors:')) {
          currentEducation.honors = line.split(':')[1].trim();
        }
      }
    });

    if (currentEducation) {
      education.push(currentEducation);
    }

    return education;
  }

  parseCivilService(text) {
    const sectionText = this.getSectionText(text, this.sections.civilService);
    const lines = sectionText.split('\n');

    const civilService = [];
    let currentEligibility = null;

    lines.forEach(line => {
      if (line.includes('Career Service/RA 1080')) {
        if (currentEligibility) {
          civilService.push(currentEligibility);
        }
        currentEligibility = {
          examTitle: '',
          rating: '',
          examDate: '',
          examPlace: '',
          licenseNumber: '',
          validity: ''
        };
      } else if (currentEligibility) {
        if (line.includes('Rating:')) {
          currentEligibility.rating = line.split(':')[1].trim();
        } else if (line.includes('Date of Examination:')) {
          currentEligibility.examDate = line.split(':')[1].trim();
        } else if (line.includes('Place of Examination:')) {
          currentEligibility.examPlace = line.split(':')[1].trim();
        } else if (line.includes('License Number:')) {
          currentEligibility.licenseNumber = line.split(':')[1].trim();
        } else if (line.includes('Validity:')) {
          currentEligibility.validity = line.split(':')[1].trim();
        }
      }
    });

    if (currentEligibility) {
      civilService.push(currentEligibility);
    }

    return civilService;
  }

  parseWorkExperience(text) {
    const sectionText = this.getSectionText(text, this.sections.workExperience);
    const lines = sectionText.split('\n');

    const workExperience = [];
    let currentExperience = null;

    lines.forEach(line => {
      if (line.includes('Position Title:')) {
        if (currentExperience) {
          workExperience.push(currentExperience);
        }
        currentExperience = {
          position: line.split(':')[1].trim(),
          company: '',
          from: '',
          to: '',
          salary: '',
          salaryGrade: '',
          appointmentStatus: '',
          isGovernmentService: false
        };
      } else if (currentExperience) {
        if (line.includes('Department / Agency / Office / Company:')) {
          currentExperience.company = line.split(':')[1].trim();
        } else if (line.includes('From:')) {
          currentExperience.from = line.split(':')[1].trim();
        } else if (line.includes('To:')) {
          currentExperience.to = line.split(':')[1].trim();
        } else if (line.includes('Salary:')) {
          currentExperience.salary = line.split(':')[1].trim();
        } else if (line.includes('Salary Grade:')) {
          currentExperience.salaryGrade = line.split(':')[1].trim();
        } else if (line.includes('Status of Appointment:')) {
          currentExperience.appointmentStatus = line.split(':')[1].trim();
        } else if (line.includes('Government Service:')) {
          currentExperience.isGovernmentService =
            line.split(':')[1].trim().toLowerCase() === 'yes';
        }
      }
    });

    if (currentExperience) {
      workExperience.push(currentExperience);
    }

    return workExperience;
  }

  parseVoluntaryWork(text) {
    const sectionText = this.getSectionText(text, this.sections.voluntaryWork);
    const lines = sectionText.split('\n');

    const voluntaryWork = [];
    let currentWork = null;

    lines.forEach(line => {
      if (line.includes('Name & Address of Organization:')) {
        if (currentWork) {
          voluntaryWork.push(currentWork);
        }
        currentWork = {
          organization: line.split(':')[1].trim(),
          from: '',
          to: '',
          hours: '',
          position: ''
        };
      } else if (currentWork) {
        if (line.includes('From:')) {
          currentWork.from = line.split(':')[1].trim();
        } else if (line.includes('To:')) {
          currentWork.to = line.split(':')[1].trim();
        } else if (line.includes('Number of Hours:')) {
          currentWork.hours = line.split(':')[1].trim();
        } else if (line.includes('Position / Nature of Work:')) {
          currentWork.position = line.split(':')[1].trim();
        }
      }
    });

    if (currentWork) {
      voluntaryWork.push(currentWork);
    }

    return voluntaryWork;
  }

  parseTraining(text) {
    const sectionText = this.getSectionText(text, this.sections.training);
    const lines = sectionText.split('\n');

    const training = [];
    let currentTraining = null;

    lines.forEach(line => {
      if (
        line.includes(
          'Title of Learning and Development Interventions/Training Programs:'
        )
      ) {
        if (currentTraining) {
          training.push(currentTraining);
        }
        currentTraining = {
          title: line.split(':')[1].trim(),
          from: '',
          to: '',
          hours: '',
          type: '',
          sponsor: ''
        };
      } else if (currentTraining) {
        if (line.includes('From:')) {
          currentTraining.from = line.split(':')[1].trim();
        } else if (line.includes('To:')) {
          currentTraining.to = line.split(':')[1].trim();
        } else if (line.includes('Number of Hours:')) {
          currentTraining.hours = line.split(':')[1].trim();
        } else if (line.includes('Type of LD:')) {
          currentTraining.type = line.split(':')[1].trim();
        } else if (line.includes('Conducted/Sponsored by:')) {
          currentTraining.sponsor = line.split(':')[1].trim();
        }
      }
    });

    if (currentTraining) {
      training.push(currentTraining);
    }

    return training;
  }

  parseOtherInfo(text) {
    const sectionText = this.getSectionText(text, this.sections.otherInfo);
    const lines = sectionText.split('\n');

    const otherInfo = {
      skills: [],
      nonAcademicDistinctions: [],
      membership: []
    };

    let currentSection = '';

    lines.forEach(line => {
      if (line.includes('Skills and Competencies:')) {
        currentSection = 'skills';
      } else if (line.includes('Non-Academic Distinctions / Recognition:')) {
        currentSection = 'nonAcademicDistinctions';
      } else if (line.includes('Membership in Association / Organization:')) {
        currentSection = 'membership';
      } else if (line.trim() && currentSection) {
        otherInfo[currentSection].push(line.trim());
      }
    });

    return otherInfo;
  }

  parseReferences(text) {
    const sectionText = this.getSectionText(text, this.sections.references);
    const lines = sectionText.split('\n');

    const references = [];
    let currentReference = null;

    lines.forEach(line => {
      if (line.includes('Name:')) {
        if (currentReference) {
          references.push(currentReference);
        }
        currentReference = {
          name: line.split(':')[1].trim(),
          address: '',
          telephone: ''
        };
      } else if (currentReference) {
        if (line.includes('Address:')) {
          currentReference.address = line.split(':')[1].trim();
        } else if (line.includes('Telephone:')) {
          currentReference.telephone = line.split(':')[1].trim();
        }
      }
    });

    if (currentReference) {
      references.push(currentReference);
    }

    return references;
  }
}

module.exports = new PDSParser();
