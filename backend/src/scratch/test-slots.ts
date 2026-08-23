import { SlotService } from '../services/slot.service';

async function main() {
  const service = new SlotService();
  const doctorId = '82f303af-82fe-4928-94f8-ed77bbe97d62'; // Dr. Sarah Mehta
  
  // Test for a Tuesday in the future (e.g. 2026-08-25)
  const date = '2026-08-25';

  try {
    const slots = await service.getAvailableSlots(doctorId, date);
    console.log(`Successfully generated ${slots.length} slots for ${date}:`);
    for (const slot of slots.slice(0, 5)) {
      console.log(`  - ${slot.startTime} to ${slot.endTime} (Available: ${slot.isAvailable})`);
    }
  } catch (error) {
    console.error('Error generating slots:', error);
  }
}

main().catch(console.error);
