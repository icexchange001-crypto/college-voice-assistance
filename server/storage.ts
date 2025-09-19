import { type User, type InsertUser, type ChatMessage, type InsertChatMessage, type CollegeInfo, type InsertCollegeInfo } from "@shared/schema";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat messages
  getChatMessages(limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // College information
  getCollegeInfo(): Promise<CollegeInfo[]>;
  getCollegeInfoByCategory(category: string): Promise<CollegeInfo[]>;
  createCollegeInfo(info: InsertCollegeInfo): Promise<CollegeInfo>;
  searchCollegeInfo(query: string): Promise<CollegeInfo[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private chatMessages: ChatMessage[];
  private collegeInfo: CollegeInfo[];

  constructor() {
    this.users = new Map();
    this.chatMessages = [];
    this.collegeInfo = [];
    this.initializeCollegeData();
  }

  private initializeCollegeData() {
    try {
      // Read college info from JSON file
      const collegeInfoPath = path.join(process.cwd(), 'client', 'data', 'college-info.json');
      const classesPath = path.join(process.cwd(), 'client', 'data', 'classes-schedule.json');
      
      const collegeInfoData = JSON.parse(fs.readFileSync(collegeInfoPath, 'utf8'));
      const classesData = JSON.parse(fs.readFileSync(classesPath, 'utf8'));

      const defaultData: Omit<CollegeInfo, 'id'>[] = [
        // College Basic Info
        {
          category: 'college',
          title: 'College Basic Information',
          content: `${collegeInfoData.college.name} established in ${collegeInfoData.college.established_year}. Principal: ${collegeInfoData.college.principal}. Vice Principal: ${collegeInfoData.college.vice_principal}. Registrar: ${collegeInfoData.college.registrar}. Founder: ${collegeInfoData.college.founder}. Motto: "${collegeInfoData.college.motto}". Address: ${collegeInfoData.college.address}. Phone: ${collegeInfoData.college.phone}. Email: ${collegeInfoData.college.email}. Website: ${collegeInfoData.college.website}. Affiliated with: ${collegeInfoData.college.affiliation}.`,
          metadata: JSON.stringify(collegeInfoData.college)
        },
        
        // Departments
        ...Object.entries(collegeInfoData.departments)
          .filter(([key, dept]: [string, any]) => key !== 'departments_page_url')
          .map(([key, dept]: [string, any]) => ({
            category: 'department',
            title: `${key.charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)} Department`,
            content: `${key.charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)} Department Head: ${dept.head}. Programs offered: ${dept.programs.join(', ')}. Specializations: ${dept.specializations.join(', ')}.`,
            metadata: JSON.stringify({ name: key, ...dept })
          })),

        // Contact Information
        {
          category: 'contact',
          title: 'Contact Information',
          content: `Principal Office: ${collegeInfoData.contacts.principal_office}. Admission Office: ${collegeInfoData.contacts.admission_office}. Academic Office: ${collegeInfoData.contacts.academic_office}. Hostel Office: ${collegeInfoData.contacts.hostel_office}. Placement Cell: ${collegeInfoData.contacts.placement_cell}.`,
          metadata: JSON.stringify(collegeInfoData.contacts)
        },

        // Timings
        {
          category: 'timings',
          title: 'College Timings',
          content: `College Hours: ${collegeInfoData.timings.college_hours}. Library: ${collegeInfoData.timings.library}. Lab Hours: ${collegeInfoData.timings.lab_hours}. Office Hours: ${collegeInfoData.timings.office_hours}.`,
          metadata: JSON.stringify(collegeInfoData.timings)
        },

        // Hostel
        {
          category: 'hostel',
          title: 'Hostel Information',
          content: `Boys hostel timing: ${collegeInfoData.hostel.boys_timing}. Girls hostel timing: ${collegeInfoData.hostel.girls_timing}. ${collegeInfoData.hostel.late_entry_policy}. Facilities: ${collegeInfoData.hostel.facilities.join(', ')}.`,
          metadata: JSON.stringify(collegeInfoData.hostel)
        },

        // Events
        ...collegeInfoData.events.map((event: any) => ({
          category: 'events',
          title: event.name,
          content: `${event.name} (${event.type}) held in ${event.month}. ${event.description || ''} Activities: ${event.activities ? event.activities.join(', ') : ''}.`,
          metadata: JSON.stringify(event)
        })),

        // Sports & Clubs
        {
          category: 'sports',
          title: 'Sports and Athletics',
          content: `Sports facilities: ${collegeInfoData.sports.facilities.join(', ')}. Clubs: ${collegeInfoData.sports.clubs.join(', ')}. Achievements: ${collegeInfoData.sports.achievements.join(', ')}.`,
          metadata: JSON.stringify(collegeInfoData.sports)
        },

        // NCC & NSS
        {
          category: 'activities',
          title: 'NCC Activities',
          content: `NCC Units: ${collegeInfoData.ncc.units.join(', ')}. Activities: ${collegeInfoData.ncc.activities.join(', ')}.`,
          metadata: JSON.stringify(collegeInfoData.ncc)
        },
        {
          category: 'activities',
          title: 'NSS Activities',
          content: `NSS Motto: "${collegeInfoData.nss.motto}". Activities: ${collegeInfoData.nss.activities.join(', ')}.`,
          metadata: JSON.stringify(collegeInfoData.nss)
        },

        // Cultural Activities
        {
          category: 'cultural',
          title: 'Cultural Activities',
          content: `Annual Cultural Fest: ${collegeInfoData.cultural.annual_fest}. Events: ${collegeInfoData.cultural.events.join(', ')}. Clubs: ${collegeInfoData.cultural.clubs.join(', ')}.`,
          metadata: JSON.stringify(collegeInfoData.cultural)
        },

        // Admission
        {
          category: 'admission',
          title: 'Admission Process',
          content: `Application Period: ${collegeInfoData.admissions.application_period}. Merit List: ${collegeInfoData.admissions.merit_list_date}. Counseling: ${collegeInfoData.admissions.counseling_dates}. Portal: ${collegeInfoData.admissions.online_admission_portal}. Selection Criteria: ${collegeInfoData.admissions.selection_criteria}.`,
          metadata: JSON.stringify(collegeInfoData.admissions)
        },

        // Teachers and Faculty
        ...classesData.teachers.map((teacher: any) => ({
          category: 'faculty',
          title: `Faculty - ${teacher.name}`,
          content: `${teacher.name} from ${teacher.department}. Cabin: ${teacher.cabin}. Timing: ${teacher.timing}. Subjects: ${teacher.subjects.join(', ')}.`,
          metadata: JSON.stringify(teacher)
        })),

        // Classes Schedule
        ...classesData.classes.map((courseInfo: any) => ({
          category: 'classes',
          title: `${courseInfo.course} Schedule`,
          content: courseInfo.subjects.map((subject: any) => 
            `${subject.subject} by ${subject.teacher} in ${subject.room} (${subject.timing}) on ${subject.days.join(', ')}`
          ).join('. '),
          metadata: JSON.stringify(courseInfo)
        })),

        // Room Information
        {
          category: 'rooms',
          title: 'Room Information',
          content: Object.entries(classesData.rooms).map(([room, description]) => `${room}: ${description}`).join('. '),
          metadata: JSON.stringify(classesData.rooms)
        }
      ];

      defaultData.forEach(data => {
        const id = randomUUID();
        this.collegeInfo.push({ ...data, id });
      });

      console.log(`Loaded ${defaultData.length} college information entries from JSON files`);
    } catch (error) {
      console.error('Error loading college data from JSON files:', error);
      // Fallback to basic data if files not found
      const basicData: Omit<CollegeInfo, 'id'>[] = [
        {
          category: 'college',
          title: 'College Information',
          content: 'R.K.S.D. (PG) College, Kaithal - Please contact college for more information.',
          metadata: JSON.stringify({ error: 'Data files not found' })
        }
      ];
      
      basicData.forEach(data => {
        const id = randomUUID();
        this.collegeInfo.push({ ...data, id });
      });
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getChatMessages(limit = 50): Promise<ChatMessage[]> {
    return this.chatMessages
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
      .slice(0, limit)
      .reverse();
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const chatMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date(),
      language: message.language ?? null,
    };
    this.chatMessages.push(chatMessage);
    return chatMessage;
  }

  async getCollegeInfo(): Promise<CollegeInfo[]> {
    return this.collegeInfo;
  }

  async getCollegeInfoByCategory(category: string): Promise<CollegeInfo[]> {
    return this.collegeInfo.filter(info => info.category === category);
  }

  async createCollegeInfo(info: InsertCollegeInfo): Promise<CollegeInfo> {
    const id = randomUUID();
    const collegeInfo: CollegeInfo = { 
      ...info, 
      id,
      metadata: info.metadata ?? null 
    };
    this.collegeInfo.push(collegeInfo);
    return collegeInfo;
  }

  async searchCollegeInfo(query: string): Promise<CollegeInfo[]> {
    const searchTerm = query.toLowerCase();
    return this.collegeInfo.filter(info => 
      info.title.toLowerCase().includes(searchTerm) ||
      info.content.toLowerCase().includes(searchTerm) ||
      info.category.toLowerCase().includes(searchTerm)
    );
  }
}

export const storage = new MemStorage();
