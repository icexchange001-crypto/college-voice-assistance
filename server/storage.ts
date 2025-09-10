import { type User, type InsertUser, type ChatMessage, type InsertChatMessage, type CollegeInfo, type InsertCollegeInfo } from "@shared/schema";
import { randomUUID } from "crypto";

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
    const defaultData: Omit<CollegeInfo, 'id'>[] = [
      {
        category: 'hostel',
        title: 'Hostel Timings',
        content: 'Boys hostel timing is 10:00 PM and girls hostel timing is 9:30 PM. Late entry requires prior permission from the warden.',
        metadata: JSON.stringify({ boys_timing: '22:00', girls_timing: '21:30' })
      },
      {
        category: 'department',
        title: 'Computer Science Department',
        content: 'The Computer Science Department offers B.Tech, M.Tech, and PhD programs. Faculty includes experienced professors in AI, ML, and software engineering.',
        metadata: JSON.stringify({ programs: ['B.Tech', 'M.Tech', 'PhD'], specializations: ['AI', 'ML', 'Software Engineering'] })
      },
      {
        category: 'contact',
        title: 'Main Office Contact',
        content: 'RKSD College Main Office - Phone: +91-XXX-XXXXXXX, Email: info@rksd.edu.in, Address: RKSD College Campus, City',
        metadata: JSON.stringify({ phone: '+91-XXX-XXXXXXX', email: 'info@rksd.edu.in' })
      },
      {
        category: 'events',
        title: 'Annual Tech Fest',
        content: 'Annual Tech Fest "Technova" is organized every March featuring coding competitions, robotics, and cultural events.',
        metadata: JSON.stringify({ event_name: 'Technova', month: 'March', activities: ['coding', 'robotics', 'cultural'] })
      },
      {
        category: 'admission',
        title: 'Admission Process',
        content: 'Admissions are based on entrance exam scores. Application forms available online from May to July. Merit list published in August.',
        metadata: JSON.stringify({ application_period: 'May-July', result_month: 'August' })
      }
    ];

    defaultData.forEach(data => {
      const id = randomUUID();
      this.collegeInfo.push({ ...data, id });
    });
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
    const collegeInfo: CollegeInfo = { ...info, id };
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
